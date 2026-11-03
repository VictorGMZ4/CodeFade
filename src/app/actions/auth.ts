"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { slugify } from "@/lib/format";

export type AuthState = { errors?: Record<string, string[] | undefined>; message?: string } | undefined;

const SignupSchema = z.object({
  shopName: z.string().trim().min(2, { error: "Escribe el nombre de la barbería." }).max(60),
  name: z.string().trim().min(2, { error: "Escribe tu nombre." }).max(60),
  email: z.email({ error: "Correo no válido." }).trim().toLowerCase(),
  password: z.string().min(8, { error: "Mínimo 8 caracteres." }).max(100),
  timezone: z.string().min(3),
  currency: z.string().length(3),
  countryCode: z.string().regex(/^\d{1,4}$/),
});

// Horario inicial del primer barbero: lunes a sábado, 9:00-13:00 y 14:00-19:00.
const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startMin: 9 * 60, endMin: 13 * 60 },
  { weekday, startMin: 14 * 60, endMin: 19 * 60 },
]);

export async function signup(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;

  if (!Intl.supportedValuesOf("timeZone").includes(data.timezone)) {
    return { errors: { timezone: ["Zona horaria no válida."] } };
  }

  const exists = await db.user.findUnique({ where: { email: data.email } });
  if (exists) return { errors: { email: ["Ya existe una cuenta con este correo."] } };

  const slug = await uniqueSlug(data.shopName);
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          shop: {
            create: {
              name: data.shopName,
              slug,
              timezone: data.timezone,
              currency: data.currency,
              countryCode: data.countryCode,
              barbers: {
                create: { name: data.name, workingHours: { create: DEFAULT_HOURS } },
              },
            },
          },
        },
      },
    },
  });

  await createSession(user.id);
  redirect("/panel/servicios?bienvenida=1");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "barberia";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.shop.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const LoginSchema = z.object({
  email: z.email({ error: "Correo no válido." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

// Hash ficticio para que un correo inexistente tarde lo mismo que uno real.
const DUMMY_HASH = "$2b$12$epNuUs0XGUHgZQLbk2hToOvySFE4oglMV96poOOnFsIC9GmQ0gOyC";

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { message: "Correo o contraseña incorrectos." };

  await createSession(user.id);
  redirect("/panel");
}

export async function logout() {
  await deleteSession();
  redirect("/ingresar");
}
