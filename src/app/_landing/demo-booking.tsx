"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEMO_PROS, DEMO_SERVICES, DEMO_SHOP, formatPrice, formatTime, openDays } from "./demo-data";
import { useNow } from "./use-now";

const ANY = "";

/**
 * La reserva de un negocio de ejemplo, funcionando: el visitante elige como
 * lo haría su cliente y ve el WhatsApp que le llegaría. Los días y las horas
 * salen de la hora real de Bogotá en su navegador.
 */
export function DemoBooking() {
  const now = useNow();
  const [serviceId, setServiceId] = useState(DEMO_SERVICES[0].id);
  const [proId, setProId] = useState(ANY);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const opened = useRef(false);

  // Al confirmar, el foco pasa al resultado; al volver, al formulario.
  useEffect(() => {
    if (confirmed) resultRef.current?.focus();
    else if (opened.current) formRef.current?.querySelector<HTMLElement>("[aria-pressed='true']")?.focus();
    opened.current = true;
  }, [confirmed]);

  if (now === null) return <StaticBooking />;

  const service = DEMO_SERVICES.find((s) => s.id === serviceId) ?? DEMO_SERVICES[0];
  const days = openDays(now, proId || null, service.minutes);
  const day = days.find((d) => d.key === dayKey) ?? days[0];
  const start = time !== null && day?.slots.includes(time) ? time : null;
  // Con «el primero libre», el profesional que está libre a esa hora.
  const pro = DEMO_PROS.find((p) => p.id === proId) ?? DEMO_PROS[start !== null && day ? day.pros[day.slots.indexOf(start)] : 0];
  const restart = () => setConfirmed(false);

  if (confirmed && day && start !== null) {
    return (
      <div data-ui className="lp-ui lp-demo">
        <p className="lp-ui-title" ref={resultRef} tabIndex={-1}>Así le llega a tu cliente</p>
        <div className="lp-wa">
          <p className="lp-wa-from">{DEMO_SHOP}</p>
          <p>
            Hola{name.trim() ? `, ${name.trim()}` : ""}. Tu cita quedó para el {day.long} a las {formatTime(start)}: {service.name} con{" "}
            {pro.name} ({formatPrice(service.price)}). Te la recordamos un día antes.
          </p>
        </div>
        <p className="lp-ui-note">Y a {pro.name} le llega un aviso con la cita nueva.</p>
        <button type="button" className="lp-ui-btn lp-ui-btn-quiet" onClick={restart}>Reservar otra</button>
      </div>
    );
  }

  return (
    <form ref={formRef} data-ui className="lp-ui lp-demo" onSubmit={(e) => { e.preventDefault(); if (start !== null) setConfirmed(true); }}>
      <p className="lp-ui-title">{DEMO_SHOP}</p>
      <Choices label="Servicio" items={DEMO_SERVICES.map((s) => ({ id: s.id, text: s.name, note: `${s.minutes} min · ${formatPrice(s.price)}` }))}
        value={serviceId} onChange={(id) => { setServiceId(id); setTime(null); }} wide />
      <Choices label="Profesional" items={[...DEMO_PROS.map((p) => ({ id: p.id, text: p.name })), { id: ANY, text: "El primero libre" }]}
        value={proId} onChange={(id) => { setProId(id); setTime(null); }} />
      <Choices label="Día" items={days.map((d) => ({ id: d.key, text: d.label }))} value={day?.key ?? ""}
        onChange={(key) => { setDayKey(key); setTime(null); }} />
      <Choices label="Hora" items={(day?.slots ?? []).map((t) => ({ id: String(t), text: formatTime(t) }))}
        value={start === null ? "" : String(start)} onChange={(t) => setTime(Number(t))} grid />
      <div className="lp-demo-end">
        <label className="lp-ui-field">
          <span>Tu nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} placeholder="Laura" autoComplete="off" />
        </label>
        <button type="submit" className="lp-ui-btn" disabled={start === null}>
          {start === null ? "Elige una hora" : `Reservar a las ${formatTime(start)}`}
        </button>
      </div>
    </form>
  );
}

type Item = { id: string; text: string; note?: string };

function Choices({ label, items, value, onChange, wide, grid }: {
  label: string; items: Item[]; value: string; onChange: (id: string) => void; wide?: boolean; grid?: boolean;
}) {
  return (
    <fieldset className="lp-ui-group">
      <legend>{label}</legend>
      <div className={wide ? "lp-ui-rows" : grid ? "lp-ui-grid" : "lp-ui-chips"}>
        {items.map((item) => (
          <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}
            className={wide ? "lp-ui-row" : "lp-ui-chip"}>
            <span>{item.text}</span>
            {item.note && <span className="lp-ui-note">{item.note}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Sin JavaScript: los servicios y un enlace a la reserva de ejemplo real. */
function StaticBooking() {
  return (
    <div data-ui className="lp-ui lp-demo">
      <p className="lp-ui-title">{DEMO_SHOP}</p>
      <ul className="lp-ui-rows">
        {DEMO_SERVICES.map((s) => (
          <li key={s.id} className="lp-ui-row">
            <span>{s.name}</span>
            <span className="lp-ui-note">{s.minutes} min · {formatPrice(s.price)}</span>
          </li>
        ))}
      </ul>
      <Link href="/b/demo" className="lp-ui-btn">Probar la reserva de ejemplo</Link>
    </div>
  );
}
