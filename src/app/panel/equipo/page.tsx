import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { WEEKDAYS } from "@/lib/time";
import { NewBarberForm } from "./new-barber-form";

export const metadata: Metadata = { title: "Equipo" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <TeamPageContent />
    </Suspense>
  );
}

async function TeamPageContent() {
  const { shop } = await requireShop();
  const barbers = await db.barber.findMany({
    where: { shopId: shop.id },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { workingHours: { select: { weekday: true } } },
  });

  return (
    <>
      <PageTitle title="Equipo" description="Barberos, horarios y ausencias." />
      <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <Card className="divide-y divide-line">
          {barbers.map((b) => {
            const days = new Set(b.workingHours.map((h) => h.weekday));
            return (
              <Link key={b.id} href={`/panel/equipo/${b.id}`} className="press flex items-center gap-4 p-4 hover:bg-paper/60">
                <span className="grid place-items-center size-10 rounded-full bg-accent-soft text-accent-ink font-medium shrink-0">
                  {b.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={b.active ? "font-medium truncate" : "font-medium truncate text-muted"}>
                    {b.name}
                    {!b.active && <span className="ml-2 text-xs font-normal">(inactivo)</span>}
                  </p>
                  <p className="text-sm text-muted flex gap-1 mt-0.5" aria-label="Días que trabaja">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <span key={d} className={days.has(d) ? "text-ink" : "opacity-35"}>
                        {WEEKDAYS[d].slice(0, 1)}
                      </span>
                    ))}
                  </p>
                </div>
                <span className="text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            );
          })}
        </Card>
        <Card className="p-5">
          <h2 className="font-medium mb-1">Añadir barbero</h2>
          <p className="text-sm text-muted mb-4">Empieza con el mismo horario que el primero; luego puedes cambiarlo.</p>
          <NewBarberForm />
        </Card>
      </div>
    </>
  );
}
