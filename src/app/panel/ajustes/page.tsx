import type { Metadata } from "next";
import { Suspense } from "react";
import { removeShopCover, removeShopLogo, saveShopCover, saveShopLogo } from "@/app/actions/photos";
import { PhotoPicker } from "@/components/photo";
import { PageSkeleton } from "@/components/skeleton";
import { Card, PageTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { CopyLink } from "../copy-link";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <SettingsPageContent />
    </Suspense>
  );
}

async function SettingsPageContent() {
  const { shop } = await requireOwner();
  const base = process.env.APP_URL ?? "";

  return (
    <>
      <PageTitle title="Ajustes" />
      <Card className="p-5 mb-6">
        <h2 className="font-medium mb-1">Tu enlace de reservas</h2>
        <p className="text-sm text-muted mb-4">Ponlo en tu bio de Instagram, en WhatsApp Business o en Google Maps.</p>
        <CopyLink url={`${base}/b/${shop.slug}`} />
      </Card>
      <Card className="p-5 mb-6 grid gap-6">
        <h2 className="font-medium -mb-2">Imagen del negocio</h2>
        <PhotoPicker
          label="Logo"
          hint="Se ve en tu página de reservas. Se recorta en cuadrado."
          url={shop.logoUrl}
          fallback={shop.name.slice(0, 1).toUpperCase()}
          shape="square"
          upload={saveShopLogo}
          remove={removeShopLogo}
        />
        <PhotoPicker
          label="Portada"
          hint="Imagen ancha arriba de tu página de reservas: el local, tu equipo o un trabajo."
          url={shop.coverUrl}
          fallback=""
          shape="wide"
          upload={saveShopCover}
          remove={removeShopCover}
        />
      </Card>
      <Card className="p-5">
        <SettingsForm
          shop={{
            name: shop.name,
            businessType: shop.businessType,
            slug: shop.slug,
            phone: shop.phone ?? "",
            address: shop.address ?? "",
            slotMinutes: shop.slotMinutes,
            leadTimeMinutes: shop.leadTimeMinutes,
            bookingWindowDays: shop.bookingWindowDays,
            reminderHours: shop.reminderHours,
          }}
          base={base}
        />
      </Card>
    </>
  );
}
