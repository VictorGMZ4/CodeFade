import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatDayLong, formatTime } from "@/lib/time";
import { CancelButton } from "./cancel-button";

export const metadata: Metadata = {
  title: "Tu cita",
  // El enlace es privado: que no lo indexen los buscadores.
  robots: { index: false, follow: false },
};

export default function AppointmentPage(props: PageProps<"/cita/[token]">) {
  return (
    <Suspense fallback={<main className="flex-1 w-full max-w-lg mx-auto px-4 pt-8"><PageSkeleton rows={2} /></main>}>
      <AppointmentPageContent {...props} />
    </Suspense>
  );
}

async function AppointmentPageContent({ params, searchParams }: PageProps<"/cita/[token]">) {
  const { token } = await params;
  const { nueva } = await searchParams;
  const a = await db.appointment.findUnique({
    where: { manageToken: token },
    include: { shop: true, service: true, barber: true, customer: { select: { name: true } } },
  });
  if (!a) notFound();

  const tz = a.shop.timezone;
  const upcoming = a.status === "BOOKED" && a.startsAt > new Date();
  const calendarUrl = googleCalendarUrl({
    title: `${a.service.name} en ${a.shop.name}`,
    start: a.startsAt,
    end: a.endsAt,
    location: a.shop.address ?? a.shop.name,
  });

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      {nueva && a.status === "BOOKED" && (
        <div className="step-enter mb-6">
          <p className="grid place-items-center size-12 rounded-full bg-ok-soft text-ok text-xl mb-4" aria-hidden>
            ✓
          </p>
          <h1 className="font-display text-[32px] leading-tight tracking-tight">¡Listo, {a.customer.name.split(" ")[0]}!</h1>
          <p className="text-muted mt-1">Tu cita está reservada. Te enviaremos un recordatorio antes.</p>
        </div>
      )}
      {!nueva && <h1 className="font-display text-[32px] leading-tight tracking-tight mb-6">Tu cita</h1>}

      {a.status === "CANCELLED" && (
        <div className="mb-4">
          <Notice tone="error">Esta cita está cancelada.</Notice>
        </div>
      )}

      <Card className="p-5 grid gap-4">
        <div>
          <p className="text-sm text-muted">{a.shop.name}</p>
          <p className="text-xl font-medium first-letter:uppercase mt-0.5">
            {formatDayLong(a.startsAt, tz)}, {formatTime(a.startsAt, tz)}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          <dt className="text-muted">Servicio</dt>
          <dd>{a.service.name}</dd>
          <dt className="text-muted">Profesional</dt>
          <dd>{a.barber.name}</dd>
          <dt className="text-muted">Precio</dt>
          <dd className="tabular-nums">{formatPrice(a.priceCents, a.shop.currency)}</dd>
          {a.shop.address && (
            <>
              <dt className="text-muted">Dirección</dt>
              <dd>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.shop.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {a.shop.address}
                </a>
              </dd>
            </>
          )}
        </dl>
      </Card>

      {upcoming && (
        <div className="grid gap-2 mt-4">
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "h-12")}>
            Añadir a Google Calendar
          </a>
          <CancelButton token={token} />
        </div>
      )}

      <p className="text-sm text-muted text-center mt-8">
        Guarda este enlace para ver o cancelar tu cita.{" "}
        <Link href={`/b/${a.shop.slug}`} className="text-ink underline underline-offset-4">
          Reservar otra
        </Link>
      </p>
    </main>
  );
}

function googleCalendarUrl({ title, start, end, location }: { title: string; start: Date; end: Date; location: string }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${fmt(start)}/${fmt(end)}`, location });
  return `https://calendar.google.com/calendar/render?${params}`;
}
