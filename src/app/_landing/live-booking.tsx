"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { fetchOpenDays, fetchSlots } from "@/app/b/[slug]/actions";
import { cx } from "@/components/ui";

type Service = { id: string; name: string; duration: string; price: string };

/**
 * La reserva de la barbería de ejemplo, en vivo: elige un servicio y ve los
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

  // Solo consulta cuando el bloque está a la vista (hay dos copias: móvil y escritorio).
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
    <div ref={rootRef} data-ui className="bg-paper text-ink p-5 sm:p-6 w-full">
      <p className="font-display text-[26px]">{shopName}</p>
      <p className="text-[15px] text-muted mt-1">Reserva de ejemplo con horarios reales</p>

      <fieldset className="mt-5">
        <legend className="text-[15px] font-medium mb-2">Servicio</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {services.map((s) => (
            <label
              key={s.id}
              className={cx(
                "press cursor-pointer px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                serviceId === s.id ? "bg-ink text-paper" : "bg-surface hover:bg-raised",
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
              <span className="block text-[15px] font-medium leading-snug">{s.name}</span>
              <span className="block text-[13px] opacity-75 tabular-nums">
                {s.duration} · {s.price}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 min-h-[124px]" aria-live="polite">
        {failed ? (
          <p className="text-[15px] text-muted">
            No se pudieron cargar los horarios.{" "}
            <Link href={`/b/${slug}`} className="underline underline-offset-4 text-ink">
              Abre la reserva completa
            </Link>
            .
          </p>
        ) : pending || !result ? (
          <div className="grid grid-cols-4 gap-1.5" aria-label="Cargando horarios">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-10 bg-surface animate-pulse" />
            ))}
          </div>
        ) : result.slots.length === 0 ? (
          <p className="text-[15px] text-muted">No quedan horarios libres esta semana.</p>
        ) : (
          <>
            <p className="text-[15px] font-medium mb-2 first-letter:uppercase">{fmtDay(result.day)}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {result.slots.map((s) => (
                <Link
                  key={s}
                  href={`/b/${slug}?servicio=${serviceId}`}
                  className="press h-10 grid place-items-center bg-surface hover:bg-ink hover:text-paper text-[15px] font-medium tabular-nums"
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
