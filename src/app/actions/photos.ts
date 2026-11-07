"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ImageError, processImage } from "@/lib/images";
import { savePublicImage, deletePublicImage } from "@/lib/storage";

export type PhotoResult = { ok: true } | { error: string };
const denied = "No tienes permiso para esta acción.";
const galleryFull = "La galería ya tiene 12 fotos. Borra alguna para añadir otra.";

function refresh(slug: string) {
  revalidatePath("/panel", "layout");
  revalidatePath(`/b/${slug}`);
}

// Todas las mutaciones de fotos se coordinan por negocio. READ COMMITTED hace
// que el conteo posterior al bloqueo vea las inserciones ya confirmadas.
async function locked<T>(shopId: string, change: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Shop" WHERE "id" = ${shopId} FOR UPDATE`;
    return change(tx);
  }, { isolationLevel: "ReadCommitted" });
}

async function upload(formData: FormData, shopId: string, kind: "logo" | "cover" | "avatar" | "gallery", type: string) {
  const file = formData.get("photo");
  if (!(file instanceof File)) throw new ImageError("Selecciona una foto.");
  const data = await processImage(file, kind);
  return savePublicImage(`shops/${shopId}/${type}-${randomUUID()}.webp`, data, "image/webp");
}

function failure(error: unknown): PhotoResult {
  if (error instanceof ImageError) return { error: error.message };
  console.error("No se pudo guardar el cambio de foto.", error);
  return { error: "No se pudo guardar la foto. Inténtalo de nuevo." };
}

async function changeShopPhoto(kind: "logo" | "cover", formData?: FormData): Promise<PhotoResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: denied };
  const field = kind === "logo" ? "logoUrl" : "coverUrl";
  let uploaded: string | null = null;
  let oldUrl: string | null;
  try {
    if (formData) uploaded = await upload(formData, shop.id, kind, kind);
    oldUrl = await locked(shop.id, async (tx) => {
      const current = await tx.shop.findUnique({ where: { id: shop.id } });
      if (!current) throw new ImageError("Negocio no encontrado.");
      await tx.shop.update({ where: { id: shop.id }, data: { [field]: uploaded } });
      return current[field];
    });
  } catch (error) {
    if (uploaded) await deletePublicImage(uploaded);
    return failure(error);
  }
  if (oldUrl) await deletePublicImage(oldUrl);
  refresh(shop.slug);
  return { ok: true };
}

export async function saveShopLogo(formData: FormData): Promise<PhotoResult> {
  return changeShopPhoto("logo", formData);
}
export async function removeShopLogo(): Promise<PhotoResult> {
  return changeShopPhoto("logo");
}
export async function saveShopCover(formData: FormData): Promise<PhotoResult> {
  return changeShopPhoto("cover", formData);
}
export async function removeShopCover(): Promise<PhotoResult> {
  return changeShopPhoto("cover");
}

async function changeBarberPhoto(id: string, formData?: FormData): Promise<PhotoResult> {
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && (!barberId || id !== barberId)) return { error: denied };
  if (typeof id !== "string" || !id) return { error: "Profesional no encontrado." };
  let uploaded: string | null = null;
  let oldUrl: string | null;
  try {
    const where = { id, shopId: shop.id };
    if (!await db.barber.findFirst({ where })) return { error: "Profesional no encontrado." };
    if (formData) uploaded = await upload(formData, shop.id, "avatar", `barber-${id}`);
    oldUrl = await locked(shop.id, async (tx) => {
      const current = await tx.barber.findFirst({ where });
      if (!current) throw new ImageError("Profesional no encontrado.");
      await tx.barber.update({ where, data: { photoUrl: uploaded } });
      return current.photoUrl;
    });
  } catch (error) {
    if (uploaded) await deletePublicImage(uploaded);
    return failure(error);
  }
  if (oldUrl) await deletePublicImage(oldUrl);
  refresh(shop.slug);
  return { ok: true };
}

export async function saveBarberPhoto(formData: FormData): Promise<PhotoResult> {
  const id = formData.get("barberId");
  return changeBarberPhoto(typeof id === "string" ? id : "", formData);
}
export async function removeBarberPhoto(barberId: string): Promise<PhotoResult> {
  return changeBarberPhoto(barberId);
}

export async function addGalleryPhoto(formData: FormData): Promise<PhotoResult> {
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && !barberId) return { error: denied };
  let uploaded: string | null = null;
  try {
    const url = await upload(formData, shop.id, "gallery", "gallery");
    uploaded = url;
    await locked(shop.id, async (tx) => {
      if (await tx.shopPhoto.count({ where: { shopId: shop.id } }) >= 12) {
        throw new ImageError(galleryFull);
      }
      if (barberId && !await tx.barber.findFirst({ where: { id: barberId, shopId: shop.id } })) {
        throw new ImageError("Profesional no encontrado.");
      }
      await tx.shopPhoto.create({ data: { shopId: shop.id, barberId, url } });
    });
  } catch (error) {
    if (uploaded) await deletePublicImage(uploaded);
    return failure(error);
  }
  refresh(shop.slug);
  return { ok: true };
}

export async function deleteGalleryPhoto(id: string): Promise<PhotoResult> {
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && !barberId) return { error: denied };
  if (typeof id !== "string" || !id) return { error: "Foto no encontrada." };
  let oldUrl: string;
  try {
    oldUrl = await locked(shop.id, async (tx) => {
      const photo = await tx.shopPhoto.findFirst({ where: { id, shopId: shop.id } });
      if (!photo) throw new ImageError("Foto no encontrada.");
      if (!isOwner && photo.barberId !== barberId) throw new ImageError(denied);
      await tx.shopPhoto.delete({ where: { id, shopId: shop.id } });
      return photo.url;
    });
  } catch (error) {
    return failure(error);
  }
  await deletePublicImage(oldUrl);
  refresh(shop.slug);
  return { ok: true };
}
