"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { customerWhere } from "@/lib/customers";
import type { FormResult } from "./panel";

export async function saveCustomerNote(_state: FormResult, formData: FormData): Promise<FormResult> {
  const context = await requireShop();
  if (!context.isOwner && !context.barberId) return { error: "No tienes permiso para esta acción." };
  const id = formData.get("id");
  const notes = formData.get("notes");
  if (typeof id !== "string" || !id) return { error: "Cliente no encontrado." };
  if (typeof notes !== "string" || notes.length > 500) return { errors: { notes: ["La nota debe tener como máximo 500 caracteres."] } };
  // El permiso forma parte de la escritura, también si cambia el vínculo entre peticiones.
  const { count } = await db.customer.updateMany({ where: { ...customerWhere(context), id }, data: { notes: notes || null } });
  if (!count) return { error: "No tienes permiso para esta acción." };
  revalidatePath(`/panel/clientes/${id}`);
  return { ok: true };
}
