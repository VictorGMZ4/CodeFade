"use server";

import bcrypt from "bcryptjs";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { FormResult } from "./panel";

const AccountSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Correo no válido." })),
  password: z.string().min(8, { error: "Mínimo 8 caracteres." }).max(100),
});

function refreshAccess(id: string) {
  revalidatePath(`/panel/equipo/${id}`);
  revalidatePath("/panel", "layout");
}

export async function createBarberAccount(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const id = String(formData.get("id") ?? "");
  const parsed = AccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const barber = await db.barber.findFirst({ where: { id, shopId: shop.id } });
  if (!barber) return { error: "Barbero no encontrado." };
  if (barber.userId) return { error: "Este barbero ya tiene una cuenta vinculada." };
  const { email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { errors: { email: ["Ya existe una cuenta con este correo."] } };
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: barber.name, passwordHash, mustChangePassword: true,
          memberships: { create: { shopId: shop.id, role: "STAFF" } } },
      });
      // La condición evita reemplazar un acceso creado en otra petición simultánea.
      await tx.barber.update({ where: { id, shopId: shop.id, AND: [{ userId: null }] }, data: { userId: user.id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { errors: { email: ["Ya existe una cuenta con este correo."] } };
      if (error.code === "P2025") return { error: "El acceso ha cambiado. Actualiza la página." };
    }
    throw error;
  }
  refreshAccess(id);
  return { ok: true };
}

export async function linkOwnerAccount(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, user, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const id = String(formData.get("id") ?? "");
  // userId es único globalmente, también cuando el dueño administra varias barberías.
  if (await db.barber.findUnique({ where: { userId: user.id } })) return { error: "Tu cuenta ya está vinculada a un barbero." };
  try {
    const { count } = await db.barber.updateMany({ where: { id, shopId: shop.id, userId: null }, data: { userId: user.id } });
    if (!count) return { error: "Barbero no encontrado o con acceso ya asignado." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Tu cuenta ya está vinculada a un barbero." };
    throw error;
  }
  refreshAccess(id);
  return { ok: true };
}

export async function removeBarberAccess(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const id = String(formData.get("id") ?? "");
  const result = await db.$transaction(async (tx) => {
    const barber = await tx.barber.findFirst({ where: { id, shopId: shop.id } });
    if (!barber) return { error: "Barbero no encontrado." };
    if (!barber.userId) return { ok: true };
    const { count } = await tx.barber.updateMany({ where: { id, shopId: shop.id, userId: barber.userId }, data: { userId: null } });
    if (!count) return { error: "El acceso ha cambiado. Actualiza la página." };
    await tx.membership.deleteMany({ where: { userId: barber.userId, shopId: shop.id, role: "STAFF" } });
    return { ok: true };
  });
  refreshAccess(id);
  return result;
}
