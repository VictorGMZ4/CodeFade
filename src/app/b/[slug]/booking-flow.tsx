"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { buttonClass, cx, Field, inputClass, Notice } from "@/components/ui";
import { book, fetchOpenDays, fetchSlots, type BookingState } from "./actions";

type Service = { id: string; name: string; duration: string; price: string };
type Barber = { id: string; name: string };

const ANY = "";
const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export function BookingFlow({
  slug,
  services,
  barbers,
  timezone,
  initialServiceId,
}: {
  slug: string;
  services: Service[];
  barbers: Barber[];
  timezone: string;
  /** Servicio elegido desde un enlace (?servicio=) */
  initialServiceId?: string;
}) {
  const [serviceId, setServiceId] = useState<string | null>(
    services.find((s) => s.id === initialServiceId)?.id ?? (services.length === 1 ? services[0].id : null),
  );
  // Con un solo barbero no tiene sentido preguntar.
  const [barberId, setBarberId] = useState<string | null>(barbers.length === 1 ? barbers[0].id : null);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null); // "yyyy-MM" visible en el calendario
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [loadingDays, startDays] = useTransition();
  const [loadingSlots, startSlots] = useTransition();

  const timeRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);

  const service = services.find((s) => s.id === serviceId);
  const barberChosen = barberId !== null;

  const [loadError, setLoadError] = useState(false);

  const loadSlots = (sId: string, bId: string, d: string) => {
    setDay(d);
    setSlots(null);
    setStart(null);
    setLoadError(false);
    startSlots(async () => {
      try {
        setSlots(await fetchSlots(slug, sId, bId || null, d));
      } catch {
        setLoadError(true);
      }
    });
  };

  const fetchDays = async (sId: string, bId: string) => {
    try {
      const open = await fetchOpenDays(slug, sId, bId || null);
      setDays(open);
      if (open[0]) {
        setMonth(open[0].slice(0, 7));
        loadSlots(sId, bId, open[0]);
      }
    } catch {
      setLoadError(true);
    }
  };

  // Al cambiar servicio o barbero, recalculamos qué días tienen hueco y
  // mostramos los horarios del primero.
  const loadDays = (sId: string | null, bId: string | null) => {
    setDays(null);
    setDay(null);
    setSlots(null);
    setStart(null);
    setLoadError(false);
    if (!sId || bId === null) return;
    startDays(() => fetchDays(sId, bId));
  };

  // Caso de un único servicio y barbero: ya está todo elegido al cargar.
  const initialLoad = useRef(false);
  useEffect(() => {
    if (initialLoad.current || !serviceId || barberId === null) return;
    initialLoad.current = true;
    startDays(() => fetchDays(serviceId, barberId));
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, action, pending] = useActionState(async (prev: BookingState, formData: FormData) => {
    const result = await book(slug, prev, formData);
    // Si el hueco se acaba de ocupar, refrescamos los horarios de ese día.
    if (result?.error && serviceId && barberId !== null && day) loadSlots(serviceId, barberId, day);
    return result;
  }, undefined);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) =>
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const time = (iso: string) =>
    new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(
      new Date(iso),
    );
  const hourOf = (iso: string) => Number(time(iso).slice(0, 2));
  const dayLong = (d: string) =>
    new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${d}T12:00:00Z`),
    );

  const groups = slots
    ? [
        { label: "Mañana", items: slots.filter((s) => hourOf(s) < 12) },
        { label: "Tarde", items: slots.filter((s) => hourOf(s) >= 12 && hourOf(s) < 18) },
        { label: "Noche", items: slots.filter((s) => hourOf(s) >= 18) },
      ].filter((g) => g.items.length)
    : [];

  const summary =
    service && start
      ? `${service.name} · ${new Intl.DateTimeFormat("es", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: timezone,
        }).format(new Date(start))} · ${time(start)}`
      : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <Step title="Elige un servicio">
        <div className="grid gap-2">
          {services.map((s) => (
            <Choice
              key={s.id}
              name="service"
              checked={serviceId === s.id}
              onChange={() => {
                setServiceId(s.id);
                loadDays(s.id, barberId);
                if (barberChosen) scrollTo(timeRef);
              }}
            >
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-[14px] text-muted">{s.duration}</span>
              </span>
              <span className="font-semibold tabular-nums">{s.price}</span>
            </Choice>
          ))}
        </div>
      </Step>

      {barbers.length > 1 && serviceId && (
        <Step title="¿Con quién?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[{ id: ANY, name: "El primero libre" }, ...barbers].map((b) => (
              <Choice
                key={b.id || "any"}
                className={b.id ? undefined : "col-span-full"}
                name="barber"
                checked={barberId === b.id}
                onChange={() => {
                  setBarberId(b.id);
                  loadDays(serviceId, b.id);
                  scrollTo(timeRef);
                }}
              >
                <span
                  aria-hidden
                  className="grid place-items-center size-9 shrink-0 rounded-full bg-raised text-[14px] font-bold"
                >
                  {b.id ? b.name.slice(0, 1).toUpperCase() : "★"}
                </span>
                <span className="truncate font-semibold">{b.name}</span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {serviceId && barberChosen && (
        <Step title="Elige día y hora" ref={timeRef}>
          {loadError ? (
            <Notice tone="error">No pudimos cargar los horarios. Revisa tu conexión e inténtalo de nuevo.</Notice>
          ) : loadingDays || days === null || !month ? (
            days !== null && days.length === 0 ? (
              <p className="text-muted">No quedan horarios libres en las próximas semanas.</p>
            ) : (
              <SkeletonGrid count={35} />
            )
          ) : (
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
              <MonthCalendar
                month={month}
                openDays={days}
                selected={day}
                onMonth={setMonth}
                onSelect={(d) => serviceId && barberId !== null && loadSlots(serviceId, barberId, d)}
                label={dayLong}
              />

              <div className="min-h-24">
                {day && <p className="font-semibold mb-4 first-letter:uppercase">{dayLong(day)}</p>}
                {loadingSlots || slots === null ? (
                  <SkeletonGrid count={8} cols="grid-cols-3" />
                ) : slots.length === 0 ? (
                  <p className="text-muted">Este día ya no tiene horarios libres.</p>
                ) : (
                  <div className="grid gap-5">
                    {groups.map((g) => (
                      <div key={g.label}>
                        <p className="text-[14px] font-semibold text-muted mb-2">{g.label}</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 gap-2">
                          {g.items.map((s) => (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={start === s}
                              onClick={() => {
                                setStart(s);
                                scrollTo(detailsRef);
                              }}
                              className={cx(
                                "press h-12 rounded-lg border text-[16px] font-semibold tabular-nums",
                                start === s
                                  ? "bg-accent border-accent-line text-accent-ink"
                                  : "border-accent-line text-accent-ink hover:bg-accent-soft",
                              )}
                            >
                              {time(s)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Step>
      )}

      {start && (
        <Step title="Tus datos" ref={detailsRef}>
          <form id="booking" action={action} className="grid gap-4 max-w-[520px]">
            <input type="hidden" name="serviceId" value={serviceId ?? ""} />
            <input type="hidden" name="barberId" value={barberId ?? ""} />
            <input type="hidden" name="start" value={start} />
            {/* Trampa para bots: oculta a personas y lectores de pantalla */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

            <Field label="Nombre" error={state?.errors?.name}>
              <input
                name="name"
                required
                autoComplete="name"
                enterKeyHint="next"
                className={inputClass}
                aria-invalid={!!state?.errors?.name}
              />
            </Field>
            <Field label="WhatsApp" hint="Te enviaremos el recordatorio aquí." error={state?.errors?.phone}>
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                className={inputClass}
                aria-invalid={!!state?.errors?.phone}
              />
            </Field>
            <Field label="Correo (opcional)" error={state?.errors?.email}>
              <input
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
                className={inputClass}
                aria-invalid={!!state?.errors?.email}
              />
            </Field>
            <Field label="¿Algo que debamos saber? (opcional)">
              <textarea name="notes" rows={2} maxLength={200} className={`${inputClass} h-auto py-2.5 resize-none`} />
            </Field>
          </form>
        </Step>
      )}

      {/* Barra inferior fija con el resumen y el botón de confirmar */}
      {start && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-surface border-t border-line shadow-card pb-[env(safe-area-inset-bottom)] step-enter">
          <div className="max-w-[1100px] mx-auto px-4 py-3 grid gap-2">
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            <div className="flex items-center gap-4">
              <p className="flex-1 min-w-0 text-[15px] font-semibold leading-snug first-letter:uppercase">{summary}</p>
              <button type="submit" form="booking" disabled={pending} className={buttonClass("primary", "px-6")}>
                {pending ? "Reservando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Calendario mensual: los días con hueco se pueden elegir, el resto se ven apagados. */
function MonthCalendar({
  month,
  openDays,
  selected,
  onMonth,
  onSelect,
  label,
}: {
  month: string;
  openDays: string[];
  selected: string | null;
  onMonth: (m: string) => void;
  onSelect: (d: string) => void;
  label: (d: string) => string;
}) {
  const open = new Set(openDays);
  const months = [...new Set(openDays.map((d) => d.slice(0, 7)))].sort();
  const index = months.indexOf(month);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // lunes primero
  const title = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold first-letter:uppercase">{title}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonth(months[index - 1])}
            disabled={index <= 0}
            aria-label="Mes anterior"
            className="press size-10 rounded-full grid place-items-center text-accent-ink hover:bg-accent-soft disabled:opacity-30 disabled:pointer-events-none"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onMonth(months[index + 1])}
            disabled={index >= months.length - 1}
            aria-label="Mes siguiente"
            className="press size-10 rounded-full grid place-items-center text-accent-ink hover:bg-accent-soft disabled:opacity-30 disabled:pointer-events-none"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_LABELS.map((d) => (
          <span key={d} className="text-[13px] font-semibold text-muted py-1">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${month}-${pad(i + 1)}`;
          const available = open.has(d);
          const isSelected = d === selected;
          return available ? (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSelected}
              aria-label={label(d)}
              className={cx(
                "press aspect-square max-h-12 w-full mx-auto rounded-full grid place-items-center text-[16px] font-bold tabular-nums",
                isSelected ? "bg-accent text-accent-ink ring-2 ring-accent-line" : "bg-accent-soft text-accent-ink hover:bg-accent",
              )}
            >
              {i + 1}
            </button>
          ) : (
            <span key={d} className="aspect-square max-h-12 grid place-items-center text-[15px] text-muted/60 tabular-nums">
              {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Step({ title, children, ref }: { title: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> }) {
  return (
    <section ref={ref} className="step-enter scroll-mt-4 min-w-0 bg-surface rounded-2xl border border-line shadow-soft p-5 sm:p-7">
      <h2 className="font-display text-[20px] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Choice({
  name,
  checked,
  onChange,
  className,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        className,
        "press flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer min-w-0",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-line",
        checked ? "bg-accent border-accent-line text-accent-ink" : "border-line hover:border-accent-line",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function SkeletonGrid({ count, cols = "grid-cols-7" }: { count: number; cols?: string }) {
  return (
    <div className={cx("grid gap-2", cols)} role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-11 rounded-lg bg-raised animate-pulse" />
      ))}
    </div>
  );
}
