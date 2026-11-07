import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

/** Usuario autenticado o null. Se memoiza por petición. */
export const getUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, mustChangePassword: true, sessionVersion: true },
  });
  // Cambiar o recuperar la contraseña sube la versión y cierra las demás sesiones.
  return user && user.sessionVersion === session.version ? user : null;
});

/**
 * Barbería que administra el usuario actual. Toda acción del panel debe pasar
 * por aquí: es lo que garantiza que una barbería no toque datos de otra.
 */
export const requireShop = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/ingresar");
  if (user.mustChangePassword) redirect("/cambiar-contrasena");

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { shop: true },
    orderBy: { shop: { createdAt: "asc" } },
  });
  if (!membership) redirect("/registro");

  const barber = await db.barber.findFirst({
    where: { shopId: membership.shopId, userId: user.id },
    select: { id: true, phone: true },
  });
  return {
    user, shop: membership.shop, role: membership.role, barberId: barber?.id ?? null,
    // false si el usuario atiende como profesional y aún no tiene WhatsApp.
    hasWhatsApp: !barber || Boolean(barber.phone),
    isOwner: membership.role === "OWNER",
  };
});

/** Acceso exclusivo del dueño para páginas del panel. */
export async function requireOwner() {
  const context = await requireShop();
  if (!context.isOwner) redirect("/panel");
  return context;
}
