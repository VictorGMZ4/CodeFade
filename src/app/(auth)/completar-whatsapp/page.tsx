import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { WhatsAppForm } from "./whatsapp-form";

export const metadata: Metadata = { title: "Tu WhatsApp" };

export default function CompleteWhatsAppPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Content />
    </Suspense>
  );
}

// Pantalla obligatoria: un profesional sin WhatsApp no recibiría los avisos
// de sus reservas, así que el panel lo trae aquí antes de dejarle seguir.
async function Content() {
  const { shop, hasWhatsApp } = await requireShop();
  if (hasWhatsApp) redirect("/panel");
  return (
    <>
      <PageTitle
        title="Añade tu WhatsApp"
        description="Ahí te avisaremos de cada reserva nueva y de cada cancelación. Solo lo ve el negocio."
      />
      <WhatsAppForm countryCode={shop.countryCode} />
    </>
  );
}
