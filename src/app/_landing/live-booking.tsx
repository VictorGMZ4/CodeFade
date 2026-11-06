"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { fetchOpenDays, fetchSlots } from "@/app/b/[slug]/actions";
import { cx } from "@/components/ui";

type Service = { id: string; name: string; duration: string; price: string };

/**
 * La reserva del negocio de ejemplo, en vivo: elige un servicio y ve los
 * próximos horarios libres de verdad. Cada hora lleva a la reserva completa.
 */
export function LiveBooking({
  slug,
  shopName,
  services,
  timezone,
}: {
  slug: string;
  shopName: string;
  services: Service[];
  timezone: string;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [result, setResult] = useState<{ day: string; slots: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const load = (id: string) => {
    setFailed(false);
    start(async () => {
      try {
        const days = await fetchOpenDays(slug, id, null);
        const day = days[0];
        setResult(day ? { day, slots: (await fetchSlots(slug, id, null, day)).slice(0, 8) } : { day: "", slots: [] });
      } catch {
        setFailed(true);
      }
    });
  };

  // Solo consulta cuando el bloque está a la vista.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        load(serviceId);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(
      new Date(iso),
    );
  const fmtDay = (day: string) =>
    new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${day}T12:00:00Z`),
    );

  return (
    <div ref={rootRef} data-ui className="relative bg-surface text-ink rounded-2xl shadow-card p-5 sm:p-7 w-full">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center size-11 rounded-xl bg-brand text-brand-ink font-bold" aria-hidden>
          {shopName.slice(0, 1)}
        </span>
        <div>
          <p className="font-bold text-[18px] leading-tight">{shopName}</p>
          <p className="text-[14px] text-muted">Reserva de ejemplo con horarios reales</p>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-[14px] font-semibold text-muted mb-2">Servicio</legend>
        <div className="grid grid-cols-2 gap-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={cx(
                "press cursor-pointer rounded-lg border px-3 py-2.5",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-line",
                serviceId === s.id ? "bg-accent border-accent-line text-accent-ink" : "border-line hover:border-accent-line",
              )}
            >
              <input
                type="radio"
                name="demo-service"
                className="sr-only"
                checked={serviceId === s.id}
                onChange={() => {
                  setServiceId(s.id);
                  load(s.id);
                }}
              />
              <span className="block text-[15px] font-semibold leading-snug">{s.name}</span>
              <span className="block text-[13px] opacity-80 tabular-nums">
                {s.duration} · {s.price}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 min-h-[124px]" aria-live="polite">
        {failed ? (
          <p className="text-[15px] text-muted">
            No se pudieron cargar los horarios.{" "}
            <Link href={`/b/${slug}`} className="underline underline-offset-4 text-ink">
              Abre la reserva completa
            </Link>
            .
          </p>
        ) : pending || !result ? (
          <div className="grid grid-cols-4 gap-2" role="status" aria-label="Cargando horarios">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-11 rounded-lg bg-raised animate-pulse" />
            ))}
          </div>
        ) : result.slots.length === 0 ? (
          <p className="text-[15px] text-muted">No quedan horarios libres esta semana.</p>
        ) : (
          <>
            <p className="text-[14px] font-semibold text-muted mb-2 first-letter:uppercase">{fmtDay(result.day)}</p>
            <div className="grid grid-cols-4 gap-2">
              {result.slots.map((s) => (
                <Link
                  key={s}
                  href={`/b/${slug}?servicio=${serviceId}`}
                  className="press h-11 grid place-items-center rounded-lg border border-line text-ink font-semibold text-[15px] tabular-nums hover:bg-brand hover:border-brand hover:text-brand-ink"
                >
                  {fmtTime(s)}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
