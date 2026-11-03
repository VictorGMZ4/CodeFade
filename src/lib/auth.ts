import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

/** Usuario autenticado o null. Se memoiza por petición. */
export const getUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
});

/**
 * Barbería que administra el usuario actual. Toda acción del panel debe pasar
 * por aquí: es lo que garantiza que una barbería no toque datos de otra.
 */
export const requireShop = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/ingresar");

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { shop: true },
    orderBy: { shop: { createdAt: "asc" } },
  });
  if (!membership) redirect("/registro");

  return { user, shop: membership.shop, role: membership.role };
});
