import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { setServiceActive } from "@/app/actions/panel";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Servicios" };

export default function ServicesPage(props: PageProps<"/panel/servicios">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServicesPageContent {...props} />
    </Suspense>
  );
}

async function ServicesPageContent({ searchParams }: PageProps<"/panel/servicios">) {
  const { shop } = await requireOwner();
  const { bienvenida } = await searchParams;
  const services = await db.service.findMany({
    where: { shopId: shop.id },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <PageTitle title="Servicios" description="Lo que tus clientes pueden reservar." />

      {bienvenida && services.length === 0 && (
        <div className="mb-6">
          <Notice>
            ¡Listo! Ya creamos tu negocio con un horario de lunes a sábado. Empieza añadiendo tus servicios con su
            duración y precio.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <Card className="divide-y divide-line">
          {services.length === 0 && <p className="p-5 text-muted">Aún no tienes servicios.</p>}
          {services.map((s) => (
            <details key={s.id} className="group">
              <summary className="flex items-center gap-4 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex-1 min-w-0">
                  <p className={s.active ? "font-medium truncate" : "font-medium truncate text-muted line-through"}>
                    {s.name}
                  </p>
                  <p className="text-sm text-muted">{formatDuration(s.durationMin)}</p>
                </div>
                <p className="font-medium tabular-nums">{formatPrice(s.priceCents, shop.currency)}</p>
                <span className="text-muted transition-transform duration-200 group-open:rotate-90" aria-hidden>
                  ›
                </span>
              </summary>
              <div className="px-4 pb-4 grid gap-3">
                <ServiceForm service={s} currency={shop.currency} />
                <form action={async () => { "use server"; await setServiceActive(s.id, !s.active); }}>
                  <button className="press text-sm text-muted underline underline-offset-4">
                    {s.active ? "Ocultar de las reservas" : "Volver a mostrar en las reservas"}
                  </button>
                </form>
              </div>
            </details>
          ))}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium mb-4">Nuevo servicio</h2>
          <ServiceForm currency={shop.currency} />
        </Card>
      </div>
    </>
  );
}
