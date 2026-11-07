import "server-only";
import { db } from "@/lib/db";

/** Galería pública, con el nombre del profesional que subió cada foto. */
export async function getShopGallery(shopId: string) {
  return db.shopPhoto.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { barber: { select: { name: true } } },
  });
}
