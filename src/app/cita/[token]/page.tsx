import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatDayLong, formatTime } from "@/lib/time";
import { ExpiredLink } from "./expired-link";
import { canReschedule, RESCHEDULE_REASONS } from "@/lib/reschedule";
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
  const { nueva, cambiada } = await searchParams;
  const a = await db.appointment.findUnique({
    where: { manageToken: token },
    include: { shop: true, service: true, barber: true, customer: { select: { name: true } } },
  });
  if (!a) notFound();

  // El enlace caduca cuando termina la cita (también si se canceló): desde
  // ese momento no se muestra ningún dato de la reserva.
  if (a.endsAt <= new Date()) return <ExpiredLink slug={a.shop.slug} />;

  const allowed = canReschedule(a, a.shop, new Date());
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
          <p className="grid place-items-center size-12 rounded-full bg-brand text-brand-ink text-xl font-black mb-5" aria-hidden>
            ✓
          </p>
          <h1 className="brand-display brand-display-xl">¡Listo!</h1>
          <p className="text-muted mt-3">Tu cita está reservada. Te enviaremos un recordatorio antes.</p>
        </div>
      )}
      {!nueva && <h1 className="brand-display brand-display-xl mb-6">Tu cita</h1>}

      {a.status === "CANCELLED" && (
        <div className="mb-4">
          <Notice tone="error">Esta cita está cancelada.</Notice>
        </div>
      )}

      {cambiada === "1" && a.status === "BOOKED" && <div className="mb-4"><Notice tone="ok">Tu cita se cambió. Te enviaremos el recordatorio con la nueva hora.</Notice></div>}

      <div className="brand-night p-6 sm:p-8 grid gap-6">
        <div>
          <p className="text-[15px] text-field-muted">{a.shop.name}</p>
          <p className="brand-display brand-display-md brand-volt-text mt-2">{formatDayLong(a.startsAt, tz)}</p>
          <p className="brand-display brand-display-xl mt-1 tabular-nums">{formatTime(a.startsAt, tz)}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] pt-5 border-t border-field-ink/15">
          <dt className="text-field-muted">Servicio</dt>
          <dd>{a.service.name}</dd>
          <dt className="text-field-muted">Profesional</dt>
          <dd>{a.barber.name}</dd>
          <dt className="text-field-muted">Precio</dt>
          <dd className="tabular-nums">{formatPrice(a.priceCents, a.shop.currency)}</dd>
          {a.shop.address && (
            <>
              <dt className="text-field-muted">Dirección</dt>
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
      </div>

      {upcoming && (
        <div className="grid gap-2 mt-4">
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "h-12")}>
            Añadir a Google Calendar
          </a>
          {allowed.ok ? <Link href={`/cita/${token}/reprogramar`} className={buttonClass("secondary")}>Cambiar fecha u hora</Link>
            : <p className="text-sm text-muted">{RESCHEDULE_REASONS[allowed.reason]}</p>}
          <CancelButton token={token} />
        </div>
      )}

      <p className="text-sm text-muted text-center mt-8">
        Guarda este enlace para ver, cambiar o cancelar tu cita.{" "}
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
