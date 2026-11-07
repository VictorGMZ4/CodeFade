import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { Notice, PageTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { getShopGallery } from "@/lib/photos";
import { GalleryManager } from "./gallery-manager";

export const metadata: Metadata = { title: "Galería" };

const GALLERY_MAX = 12;

export default function GalleryPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <GalleryContent />
    </Suspense>
  );
}

async function GalleryContent() {
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && !barberId) return <Notice>Tu cuenta no está vinculada a ningún profesional. Pídeselo al dueño.</Notice>;
  const photos = await getShopGallery(shop.id);

  return (
    <>
      <PageTitle
        title="Galería"
        description={`Fotos de tus trabajos y del local en tu página de reservas. ${photos.length} de ${GALLERY_MAX}.`}
      />
      <GalleryManager
        max={GALLERY_MAX}
        photos={photos.map((p) => ({
          id: p.id,
          url: p.url,
          author: p.barber?.name ?? null,
          canDelete: isOwner || (barberId !== null && p.barberId === barberId),
        }))}
      />
    </>
  );
}
