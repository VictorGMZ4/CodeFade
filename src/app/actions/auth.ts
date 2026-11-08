"use server";

import { createHash, randomBytes } from "node:crypto";
import { clientIp, consume, release, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { sendPasswordReset } from "@/lib/notify";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { parseWhatsApp, slugify } from "@/lib/format";
import { getUser } from "@/lib/auth";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

export type AuthState = { errors?: Record<string, string[] | undefined>; message?: string; invalidToken?: boolean } | undefined;

const SignupSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES.map((type) => type.value), { error: "Elige el tipo de negocio." }),
  shopName: z.string().trim().min(2, { error: "Escribe el nombre del negocio." }).max(60),
  privacy: z.literal("on", { error: "Acepta el aviso de privacidad para crear la cuenta." }),
  name: z.string().trim().min(2, { error: "Escribe tu nombre." }).max(60),
  email: z.email({ error: "Correo no válido." }).trim().toLowerCase(),
  password: z.string().min(8, { error: "Mínimo 8 caracteres." }).max(100),
  timezone: z.string().min(3),
  currency: z.string().regex(/^[A-Z]{3}$/, { error: "Moneda no válida." }).refine((currency) => Intl.supportedValuesOf("currency").includes(currency), { error: "Moneda no válida." }),
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
  // El dueño es el primer profesional: ahí recibe los avisos de reservas.
  const whatsapp = parseWhatsApp(formData.get("phone"), data.countryCode);
  if ("error" in whatsapp) return { errors: { phone: [whatsapp.error] } };

  if ((await consume(`signup:ip:${await clientIp()}`, 5, 60 * 60 * 1000)).limited) return { message: RATE_LIMIT_MESSAGE };

  const exists = await db.user.findUnique({ where: { email: data.email } });
  if (exists) return { errors: { email: ["Ya existe una cuenta con este correo."] } };

  const slug = await uniqueSlug(data.shopName);
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      privacyAcceptedAt: new Date(),
      memberships: {
        create: {
          role: "OWNER",
          shop: {
            create: {
              name: data.shopName,
              businessType: data.businessType,
              slug,
              timezone: data.timezone,
              currency: data.currency,
              countryCode: data.countryCode,
              barbers: {
                create: { name: data.name, phone: whatsapp.phone, workingHours: { create: DEFAULT_HOURS } },
              },
            },
          },
        },
      },
    },
  });

  await createSession(user.id, user.sessionVersion);
  redirect("/panel/servicios?bienvenida=1");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "negocio";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
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

  // Se gasta el intento antes de comprobar la contraseña (también ante
  // peticiones simultáneas) y se devuelve si el ingreso es correcto: así solo
  // cuentan los fallos.
  const window = 15 * 60 * 1000;
  const ip = await clientIp();
  const attempts = await Promise.all([
    consume(`login:email-ip:${parsed.data.email}:${ip}`, 5, window),
    consume(`login:email:${parsed.data.email}`, 30, window),
    consume(`login:ip:${ip}`, 20, window),
  ]);
  if (attempts.some((a) => a.limited)) {
    // Una solicitud rechazada antes de comparar no cuenta como otro fallo.
    // Así, insistir desde una IP bloqueada no agota los intentos del correo.
    await release(...attempts.map((a) => a.id));
    return { message: RATE_LIMIT_MESSAGE };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { message: "Correo o contraseña incorrectos." };
  await release(...attempts.map((a) => a.id));

  await createSession(user.id, user.sessionVersion);
  redirect(user.mustChangePassword ? "/cambiar-contrasena" : "/panel");
}

const PasswordSchema = z.object({
  password: z.string().min(8, { error: "Mínimo 8 caracteres." }).max(100),
  confirmation: z.string(),
}).refine((data) => data.password === data.confirmation, {
  path: ["confirmation"], error: "Las contraseñas deben coincidir.",
});

export async function changePassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getUser();
  if (!user) redirect("/ingresar");
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
    const attempt = await consume(`password:user:${user.id}`, 5, 15 * 60 * 1000);
    if (attempt.limited) return { message: RATE_LIMIT_MESSAGE };
  // Quien solo tiene la sesión abierta no puede cambiarla sin la contraseña
  // actual. Excepción: el primer cambio obligatorio de la contraseña temporal.
  if (!user.mustChangePassword) {
    const current = formData.get("current");
    const stored = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (typeof current !== "string" || !current || !stored || !(await bcrypt.compare(current, stored.passwordHash))) {
      return { errors: { current: ["La contraseña actual no es correcta."] } };
    }
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const updated = await db.$transaction(async (tx) => {
    // Los enlaces de recuperación pendientes dejan de valer.
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    return tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
  });
  await release(attempt.id);
  // Cierra las demás sesiones y mantiene abierta la de este dispositivo.
  await createSession(user.id, updated.sessionVersion);
  redirect("/panel");
}

export async function logout() {
  await deleteSession();
  redirect("/ingresar");
}

const RESET_SENT = "Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.";
const RESET_INVALID = "Este enlace ya no es válido. Pide uno nuevo.";

export async function requestPasswordReset(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.string().trim().toLowerCase().pipe(z.email()).safeParse(formData.get("email"));
  if (!parsed.success) return { message: RESET_SENT };
  const hour = 60 * 60 * 1000;
  const limits = await Promise.all([consume(`reset:email:${parsed.data}`, 3, hour), consume(`reset:ip:${await clientIp()}`, 10, hour)]);
  // Tampoco se revela el estado del límite de un correo.
  if (limits.some((l) => l.limited)) return { message: RESET_SENT };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.$transaction(async (tx) => {
      // Serializa solicitudes simultáneas para invalidar también el enlace recién creado.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const now = new Date();
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      await tx.passwordResetToken.create({ data: {
        userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      } });
    });
    try {
      const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
      await sendPasswordReset({ to: user.email, name: user.name, url: `${appUrl}/restablecer/${token}` });
    } catch {
      // Un fallo del proveedor no revela la cuenta ni registra el token.
      console.error("No se pudo enviar el correo de recuperación.");
    }
  }
  return { message: RESET_SENT };
}

export async function resetPassword(token: string, _state: AuthState, formData: FormData): Promise<AuthState> {
  if (!z.string().min(1).max(64).safeParse(token).success) return { message: RESET_INVALID, invalidToken: true };
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const attempt = await consume(`reset-password:ip:${await clientIp()}`, 10, 60 * 60 * 1000);
  if (attempt.limited) return { message: RATE_LIMIT_MESSAGE };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return { message: RESET_INVALID, invalidToken: true };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const saved = await db.$transaction(async (tx) => {
    // Recomprueba la validez al escribir, incluso tras otro envío durante bcrypt.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } } });
    return true;
  });
  if (!saved) return { message: RESET_INVALID, invalidToken: true };
  await release(attempt.id);
  redirect("/ingresar?restablecida=1");
}
