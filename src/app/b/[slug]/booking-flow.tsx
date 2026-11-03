"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { cx, Field, inputClass, Notice } from "@/components/ui";
import { book, fetchOpenDays, fetchSlots, type BookingState } from "./actions";

type Service = { id: string; name: string; duration: string; price: string };
type Barber = { id: string; name: string };

const ANY = "";

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
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);
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
      if (open[0]) loadSlots(sId, bId, open[0]);
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
    setShowAllDays(false);
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
  const weekday = (d: string) =>
    new Intl.DateTimeFormat("es", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)).slice(0, 3);
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

  const visibleDays = days ? (showAllDays ? days : days.slice(0, 14)) : [];

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <Section title="Servicio">
        <div className="grid gap-1.5">
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
                <span className="block font-medium">{s.name}</span>
                <span className="block text-[15px] opacity-75">{s.duration}</span>
              </span>
              <span className="font-medium tabular-nums">{s.price}</span>
            </Choice>
          ))}
        </div>
      </Section>

      {barbers.length > 1 && serviceId && (
        <Section title="Barbero">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[{ id: ANY, name: "El primero libre" }, ...barbers].map((b) => (
              <Choice
                key={b.id || "any"}
                name="barber"
                checked={barberId === b.id}
                onChange={() => {
                  setBarberId(b.id);
                  loadDays(serviceId, b.id);
                  scrollTo(timeRef);
                }}
              >
                <span className="truncate font-medium">{b.name}</span>
              </Choice>
            ))}
          </div>
        </Section>
      )}

      {serviceId && barberChosen && (
        <Section title="Día y hora" ref={timeRef}>
          {loadError ? (
            <Notice tone="error">No pudimos cargar los horarios. Revisa tu conexión e inténtalo de nuevo.</Notice>
          ) : loadingDays || days === null ? (
            <SkeletonGrid count={14} />
          ) : days.length === 0 ? (
            <p className="text-muted">No quedan horarios libres en las próximas semanas.</p>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1">
                {visibleDays.map((d) => {
                  const selected = d === day;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => serviceId && barberId !== null && loadSlots(serviceId, barberId, d)}
                      aria-pressed={selected}
                      aria-label={dayLong(d)}
                      className={cx(
                        "press flex flex-col items-center py-2 min-w-0",
                        selected ? "bg-ink text-paper" : "bg-surface hover:bg-raised",
                      )}
                    >
                      <span className="text-[13px] opacity-75 capitalize">{weekday(d)}</span>
                      <span className="text-[19px] font-medium tabular-nums leading-tight">{Number(d.slice(8))}</span>
                    </button>
                  );
                })}
              </div>
              {days.length > 14 && (
                <button
                  type="button"
                  onClick={() => setShowAllDays((v) => !v)}
                  className="press mt-3 text-[15px] underline underline-offset-4"
                >
                  {showAllDays ? "Ver menos días" : `Ver ${days.length - 14} días más`}
                </button>
              )}

              <div className="mt-8 min-h-24">
                {day && <p className="font-medium mb-4 first-letter:uppercase">{dayLong(day)}</p>}
                {loadingSlots || slots === null ? (
                  <SkeletonGrid count={8} />
                ) : slots.length === 0 ? (
                  <p className="text-muted">Este día ya no tiene horarios libres.</p>
                ) : (
                  <div className="grid gap-5">
                    {groups.map((g) => (
                      <div key={g.label}>
                        <p className="text-[15px] text-muted mb-2">{g.label}</p>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
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
                                "press h-12 text-[16px] font-medium tabular-nums",
                                start === s ? "bg-ink text-paper" : "bg-surface hover:bg-raised",
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
            </>
          )}
        </Section>
      )}

      {start && (
        <Section title="Tus datos" ref={detailsRef}>
          <form id="booking" action={action} className="grid gap-4">
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
        </Section>
      )}

      {/* Barra inferior fija con el resumen y el botón de confirmar */}
      {start && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-ink text-paper pb-[env(safe-area-inset-bottom)] step-enter">
          <div className="max-w-5xl mx-auto px-4 py-3 grid gap-2">
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            <div className="flex items-center gap-4">
              <p className="flex-1 min-w-0 text-[15px] leading-snug first-letter:uppercase">{summary}</p>
              <button
                type="submit"
                form="booking"
                disabled={pending}
                className="press h-12 px-6 bg-paper text-ink font-medium disabled:opacity-60"
              >
                {pending ? "Reservando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, ref }: { title: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> }) {
  return (
    <section ref={ref} className="step-enter scroll-mt-6 min-w-0">
      <h2 className="font-display text-[28px] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        "press flex items-center gap-3 px-4 py-3.5 cursor-pointer min-w-0",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
        checked ? "bg-ink text-paper" : "bg-surface hover:bg-raised",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-7 gap-1" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-14 bg-surface animate-pulse" />
      ))}
    </div>
  );
}
