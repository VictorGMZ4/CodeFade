"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Img } from "@/components/photo";
import { buttonClass, cx, Field, inputClass, Notice } from "@/components/ui";
import { book, fetchOpenDays, fetchSlots, type BookingState } from "./actions";

import { MonthCalendar, SkeletonGrid } from "./month-calendar";

type Service = { id: string; name: string; duration: string; price: string };
type Barber = { id: string; name: string; photoUrl?: string | null };

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
  const [month, setMonth] = useState<string | null>(null); // "yyyy-MM" visible en el calendario
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [loadingDays, startDays] = useTransition();
  const [loadingSlots, startSlots] = useTransition();

  const timeRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const slotsRequest = useRef(0);
  const daysRequest = useRef(0);
  const serviceTitleId = useId();
  const barberTitleId = useId();

  const service = services.find((s) => s.id === serviceId);
  const barberChosen = barberId !== null;

  const [loadError, setLoadError] = useState(false);

  const loadSlots = (sId: string, bId: string, d: string) => {
    const request = ++slotsRequest.current;
    setDay(d);
    setSlots(null);
    setStart(null);
    setLoadError(false);
    startSlots(async () => {
      try {
        const next = await fetchSlots(slug, sId, bId || null, d);
        if (request === slotsRequest.current) setSlots(next);
      } catch {
        if (request === slotsRequest.current) setLoadError(true);
      }
    });
  };

  const fetchDays = async (sId: string, bId: string) => {
    const request = ++daysRequest.current;
    const slotsVersion = slotsRequest.current;
    try {
      const open = await fetchOpenDays(slug, sId, bId || null);
      if (request !== daysRequest.current) return;
      setDays(open.days);
      const first = open.days[0];
      // Los turnos del primer día llegan en la misma respuesta. No pisamos un
      // día que el usuario haya elegido mientras tanto.
      if (first && slotsVersion === slotsRequest.current) {
        slotsRequest.current++;
        setMonth(first.slice(0, 7));
        setDay(first);
        setStart(null);
        setSlots(open.firstSlots);
      }
    } catch {
      if (request === daysRequest.current) setLoadError(true);
    }
  };

  // Al cambiar servicio o barbero, recalculamos qué días tienen hueco y
  // mostramos los horarios del primero.
  const loadDays = (sId: string | null, bId: string | null) => {
    // Invalida también horarios pendientes del servicio o profesional anterior.
    daysRequest.current++;
    slotsRequest.current++;
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
    setBookingError(result?.error ?? null);
    // Si el hueco se acaba de ocupar, refrescamos los horarios de ese día.
    if (result?.code === "SLOT_TAKEN" && serviceId && barberId !== null && day) loadSlots(serviceId, barberId, day);
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
      <Step title="Elige un servicio" titleId={serviceTitleId}>
        <div role="radiogroup" aria-labelledby={serviceTitleId} className="grid gap-2">
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
        <Step title="¿Con quién?" titleId={barberTitleId}>
          <div role="radiogroup" aria-labelledby={barberTitleId} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                {"photoUrl" in b && b.photoUrl ? (
                  <Img src={b.photoUrl} alt="" className="size-9 shrink-0 rounded-full" />
                ) : (
                  <span
                    aria-hidden
                    className="grid place-items-center size-9 shrink-0 rounded-full bg-raised text-ink text-[14px] font-bold"
                  >
                    {b.id ? b.name.slice(0, 1).toUpperCase() : "★"}
                  </span>
                )}
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
                                setBookingError(null);
                                scrollTo(detailsRef);
                              }}
                              className={cx(
                                "press h-12 rounded-full border text-[16px] font-semibold tabular-nums",
                                start === s
                                  ? "bg-brand border-brand text-brand-ink"
                                  : "border-line text-ink hover:border-accent-line hover:bg-accent-soft",
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
          <form id="booking" onSubmit={(ev) => {
            ev.preventDefault();
            const data = new FormData(ev.currentTarget);
            startTransition(() => action(data));
          }} className="grid gap-4 max-w-[520px]">
            <input type="hidden" name="serviceId" value={serviceId ?? ""} />
            <input type="hidden" name="barberId" value={barberId ?? ""} />
            <input type="hidden" name="start" value={start} />
            {/* Trampa para bots: oculta a personas y lectores de pantalla */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

            <Field label="Nombre" error={state?.errors?.name}>
              <input
                name="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
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
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
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
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
                className={inputClass}
                aria-invalid={!!state?.errors?.email}
              />
            </Field>
            <Field label="¿Algo que debamos saber? (opcional)">
              <textarea name="notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} rows={2} maxLength={200} className={`${inputClass} h-auto py-2.5 resize-none`} />
            </Field>
            <label className="flex items-start gap-3 text-[15px] cursor-pointer">
              <input type="checkbox" name="privacy" required className="mt-1 size-5 shrink-0 accent-[var(--brand)]" aria-invalid={!!state?.errors?.privacy} />
              <span>
                Acepto el{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline underline-offset-4">
                  aviso de privacidad
                </a>{" "}
                y que el negocio use mis datos para gestionar la cita.
                {state?.errors?.privacy && <span className="block text-[14px] text-danger mt-1">{state.errors.privacy[0]}</span>}
              </span>
            </label>
          </form>
        </Step>
      )}

      {/* Barra inferior fija con el resumen y el botón de confirmar */}
      {(start || bookingError) && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-surface shadow-sheet rounded-t-[28px] pb-[env(safe-area-inset-bottom)] step-enter">
          <div className="max-w-[1100px] mx-auto px-5 py-4 grid gap-2">
            {bookingError && <Notice tone="error">{bookingError}</Notice>}
            <div className="flex items-center gap-4">
              <p className="flex-1 min-w-0 text-[15px] font-semibold leading-snug first-letter:uppercase">{summary}</p>
              <button type="submit" form="booking" disabled={pending || !start} className={buttonClass("primary", "px-6")}>
                {pending ? "Reservando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tarjeta de cada paso, con el titular en bloque de la marca. */
function Step({ title, titleId, children, ref }: { title: string; titleId?: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> }) {
  return (
    <section ref={ref} className="step-enter scroll-mt-4 min-w-0 brand-card p-5 sm:p-8">
      <h2 id={titleId} className="brand-display brand-display-md mb-5">{title}</h2>
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
        "press flex items-center gap-3 rounded-[14px] border px-4 py-3.5 cursor-pointer min-w-0",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-line",
        checked ? "bg-brand border-brand text-brand-ink [&_.text-muted]:text-brand-ink/75" : "bg-surface border-line hover:border-accent-line",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
