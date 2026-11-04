import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTimeOff } from "@/app/actions/panel";
import { Card } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayShort, formatTime, localDay } from "@/lib/time";
import { AccessForm } from "./access-form";
import { BarberForm } from "./barber-form";
import { TimeOffForm } from "./time-off-form";

export const metadata: Metadata = { title: "Barbero" };

export default function BarberPage(props: PageProps<"/panel/equipo/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <BarberPageContent {...props} />
    </Suspense>
  );
}

async function BarberPageContent({ params }: PageProps<"/panel/equipo/[id]">) {
  const { id } = await params;
  const { shop, user, isOwner, barberId } = await requireShop();
  if (!isOwner && id !== barberId) notFound();
  const barber = await db.barber.findFirst({
    where: { id, shopId: shop.id },
    include: {
      user: { select: { id: true, email: true } },
      workingHours: { orderBy: { startMin: "asc" } },
      timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!barber) notFound();

  const tz = shop.timezone;

  return (
    <>
      {isOwner && <Link href="/panel/equipo" className="press inline-block text-sm text-muted mb-3">
        ‹ Equipo
      </Link>}
      <h1 className="font-display text-[28px] leading-tight tracking-tight mb-6">{barber.name}</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <Card className="p-5">
          <BarberForm
            isOwner={isOwner}
            barber={{
              id: barber.id,
              name: barber.name,
              phone: barber.phone,
              active: barber.active,
              hours: barber.workingHours.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })),
            }}
          />
        </Card>

        <Card className="p-5">
          <h2 className="font-medium mb-1">Ausencias</h2>
          <p className="text-sm text-muted mb-4">Vacaciones, citas médicas… no se podrá reservar en ese tiempo.</p>
          {barber.timeOff.length > 0 && (
            <ul className="grid gap-2 mb-5">
              {barber.timeOff.map((t) => {
                const sameDay = localDay(t.startsAt, tz) === localDay(t.endsAt, tz);
                return (
                  <li key={t.id} className="flex items-center gap-3 bg-paper px-3 py-2 text-sm">
                    <div className="flex-1">
                      <p>
                        {formatDayShort(t.startsAt, tz)} {formatTime(t.startsAt, tz)} –{" "}
                        {sameDay ? "" : `${formatDayShort(t.endsAt, tz)} `}
                        {formatTime(t.endsAt, tz)}
                      </p>
                      {t.reason && <p className="text-muted">{t.reason}</p>}
                    </div>
                    <form action={async () => { "use server"; await deleteTimeOff(t.id); }}>
                      <button className="press text-muted hover:text-danger" aria-label="Eliminar ausencia">
                        ✕
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          <TimeOffForm barberId={barber.id} today={localDay(new Date(), tz)} />
        </Card>
      </div>
      {isOwner && <Card className="p-5 mt-6">
        <h2 className="font-medium mb-4">Acceso al panel</h2>
        <AccessForm key={barber.userId ?? "sin-acceso"} barberId={barber.id} account={barber.user} isSelf={barber.userId === user.id} canLinkSelf={!barberId} />
      </Card>}
    </>
  );
}
