import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { Badge, Card, Notice, buttonClass, cx } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/notify";
import {
  addDaysToDay,
  formatDayLong,
  formatTime,
  inZone,
  isValidDay,
  localDay,
  localToUtc,
} from "@/lib/time";
import { AppointmentActions } from "./appointment-actions";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Agenda" };

const STATUS_LABEL = {
  BOOKED: { text: "Reservada", className: "bg-accent-soft text-accent-ink" },
  COMPLETED: { text: "Atendida", className: "bg-ok-soft text-ok" },
  CANCELLED: { text: "Cancelada", className: "bg-raised text-muted" },
  NO_SHOW: { text: "No vino", className: "bg-danger-soft text-danger" },
} as const;

export default function AgendaPage(props: PageProps<"/panel">) {
  return (
    <Suspense fallback={<PageSkeleton rows={5} />}>
      <AgendaPageContent {...props} />
    </Suspense>
  );
}

async function AgendaPageContent({ searchParams }: PageProps<"/panel">) {
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && !barberId) return <Notice>Tu cuenta no está vinculada a ningún profesional. Pídeselo al dueño.</Notice>;
  const params = await searchParams;
  const tz = shop.timezone;
  const today = localDay(new Date(), tz);
  const day = typeof params.dia === "string" && isValidDay(params.dia) ? params.dia : today;
  const barberFilter = isOwner ? (typeof params.barbero === "string" ? params.barbero : null) : barberId;

  const dayStart = localToUtc(day, 0, tz);
  const dayEnd = localToUtc(addDaysToDay(day, 1, tz), 0, tz);

  const [barbers, appointments, serviceCount] = await Promise.all([
    isOwner ? db.barber.findMany({ where: { shopId: shop.id, active: true }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    db.appointment.findMany({
      where: {
        shopId: shop.id,
        startsAt: { gte: dayStart, lt: dayEnd },
        ...(barberFilter ? { barberId: barberFilter } : {}),
      },
      include: { customer: true, service: true, barber: true },
      orderBy: { startsAt: "asc" },
    }),
    db.service.count({ where: { shopId: shop.id, active: true } }),
  ]);

  const active = appointments.filter((a) => a.status !== "CANCELLED");
  const expected = active.reduce((sum, a) => sum + a.priceCents, 0);
  const strip = Array.from({ length: 14 }, (_, i) => addDaysToDay(today, i - 3, tz));
  const href = (d: string, b: string | null = barberFilter) =>
    `/panel?dia=${d}${b ? `&barbero=${b}` : ""}`;

  const publicUrl = `${process.env.APP_URL ?? ""}/b/${shop.slug}`;

  // Profesionales activos sin WhatsApp: no reciben los avisos de reservas.
  const withoutWhatsApp = barbers.filter((b) => !b.phone).map((b) => b.name);

  return (
    <>
      {isOwner && withoutWhatsApp.length > 0 && (
        <div className="mb-4">
          <Notice>
            {withoutWhatsApp.length === 1 ? `${withoutWhatsApp[0]} no tiene` : `${withoutWhatsApp.join(", ")} no tienen`} WhatsApp y no
            recibirá{withoutWhatsApp.length === 1 ? "" : "n"} avisos de sus reservas.{" "}
            <Link href="/panel/equipo" className="font-semibold underline underline-offset-4">Añádelo en Equipo</Link>
          </Notice>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-sm text-muted">{day === today ? "Hoy" : day === addDaysToDay(today, 1, tz) ? "Mañana" : " "}</p>
          <h1 className="font-display text-[28px] leading-tight tracking-tight first-letter:uppercase">
            {formatDayLong(dayStart, tz)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
        <Link href={`/panel/citas/nueva?dia=${day}`} className={buttonClass("primary")}>Nueva cita</Link>
        {day !== today && (
          <Link href={href(today)} className="press text-sm text-accent-ink shrink-0">
            Ir a hoy
          </Link>
        )}
        </div>
      </div>

      {/* Tira de días: scroll horizontal nativo con snap */}
      <nav aria-label="Días" className="-mx-4 px-4 mb-4 overflow-x-auto scrollbar-none snap-x">
        <ul className="flex gap-2 w-max">
          {strip.map((d) => {
            const date = inZone(localToUtc(d, 12 * 60, tz), tz);
            const selected = d === day;
            return (
              <li key={d} className="snap-start">
                <Link
                  href={href(d)}
                  aria-current={selected ? "date" : undefined}
                  className={cx(
                    "press flex flex-col items-center w-12 py-2 rounded-xl border text-sm",
                    selected ? "bg-brand text-brand-ink border-brand font-semibold" : "bg-surface border-line hover:border-accent-line",
                    d < today && !selected && "opacity-50",
                  )}
                >
                  <span className="text-[12px] opacity-70 capitalize">
                    {date.toLocaleDateString("es", { weekday: "short", timeZone: tz }).slice(0, 3)}
                  </span>
                  <span className="font-bold tabular-nums">{date.getDate()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {isOwner && barbers.length > 1 && (
        <div className="-mx-4 px-4 mb-5 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 w-max">
            {[{ id: null, name: "Todos" }, ...barbers].map((b) => (
              <Link
                key={b.id ?? "all"}
                href={href(day, b.id)}
                className={cx(
                  "press rounded-full px-3.5 py-1.5 text-sm border",
                  barberFilter === b.id ? "bg-brand text-brand-ink border-brand font-semibold" : "bg-surface border-line hover:border-accent-line",
                )}
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <p className="text-sm text-muted mb-3">
          {active.length} {active.length === 1 ? "cita" : "citas"} · {formatPrice(expected, shop.currency)} previstos
        </p>
      )}

      {appointments.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-medium">No hay citas este día</p>
          {isOwner && serviceCount === 0 ? (
            <p className="text-muted mt-1">
              Primero{" "}
              <Link href="/panel/servicios" className="font-semibold text-accent-ink underline underline-offset-4">
                añade tus servicios
              </Link>{" "}
              para que los clientes puedan reservar.
            </p>
          ) : (
            <>
              <p className="text-muted mt-1 mb-4">Comparte tu enlace para que los clientes reserven solos.</p>
              <CopyLink url={publicUrl} />
            </>
          )}
        </Card>
      ) : (
        <ol className="grid gap-2">
          {appointments.map((a) => {
            const status = STATUS_LABEL[a.status];
            const time = formatTime(a.startsAt, tz);
            const message = `Hola ${a.customer.name}, te escribimos de ${shop.name} por tu cita de ${a.service.name} el ${formatDayLong(a.startsAt, tz)} a las ${time}.`;
            return (
              <li key={a.id}>
                <Card className={cx("p-4 flex gap-4", a.status === "CANCELLED" && "opacity-60")}>
                  <div className="w-14 shrink-0">
                    <p className="font-bold tabular-nums">{time}</p>
                    <p className="text-sm text-muted tabular-nums">{formatTime(a.endsAt, tz)}</p>
                  </div>
                  <div className="flex-1 min-w-0 grid gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <p className="font-semibold truncate">{a.customer.name}</p>
                        {a.source === "MANUAL" && <Badge>Manual</Badge>}
                      </div>
                      <span className={cx("text-xs font-semibold rounded-full px-2.5 py-0.5 shrink-0", status.className)}>{status.text}</span>
                    </div>
                    <p className="text-sm text-muted truncate">
                      {a.service.name} · {a.barber.name} · {formatPrice(a.priceCents, shop.currency)}
                    </p>
                    {a.notes && <p className="text-sm bg-paper rounded-lg px-2.5 py-1.5">“{a.notes}”</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm">
                      {a.customer.phone && <><a
                        href={whatsappLink(a.customer.phone, message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press text-ok font-medium"
                      >
                        WhatsApp
                      </a>
                      <a href={`tel:${a.customer.phone}`} className="press text-muted">
                        {a.customer.phone}
                      </a></>}
                      <AppointmentActions id={a.id} status={a.status} isPast={a.startsAt < new Date()} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
