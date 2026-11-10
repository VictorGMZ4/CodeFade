"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_SHOP } from "./demo-data";

const STEPS = [
  { title: "Compartes tu enlace.", text: "En tu Instagram, en tu estado de WhatsApp o en un código QR junto al espejo.", Ui: ShareState },
  { title: "Tu cliente elige y confirma.", text: "Servicio, profesional y una hora libre, sin crear cuenta ni descargar nada.", Ui: BookedState },
  { title: "Le llega el recordatorio.", text: "Un día antes, por WhatsApp, con un enlace para cambiar la hora o cancelar.", Ui: ReminderState },
];

/**
 * Tres frases a la izquierda; a la derecha, un fragmento fijo que cambia al
 * paso que está en el centro de la pantalla. Sin JavaScript se ve el primero.
 * En el celular cada paso muestra su propio fragmento debajo del texto.
 */
export function Steps() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-steps">
      <ol className="lp-steps-list">
        {STEPS.map((s, i) => (
          <li key={s.title} data-step={i} ref={(el) => { refs.current[i] = el; }} className="lp-step" aria-current={active === i ? "step" : undefined}>
            <p className="lp-step-title">{s.title}</p>
            <p className="lp-step-text">{s.text}</p>
            <div data-ui className="lp-ui lp-step-ui" aria-hidden>
              <s.Ui />
            </div>
          </li>
        ))}
      </ol>
      <div className="lp-steps-stage">
        <div data-ui className="lp-ui lp-stage-ui" aria-hidden>
          {STEPS.map((s, i) => active === i && <s.Ui key={s.title} />)}
        </div>
      </div>
    </div>
  );
}

function ShareState() {
  return (
    <>
      <p className="lp-ui-title">Tu enlace de reservas</p>
      <p className="lp-ui-link">apptuservicio.vercel.app/b/barberia-el-bigote</p>
      <div className="lp-ui-chips">
        <span className="lp-ui-chip" data-active>Copiar enlace</span>
        <span className="lp-ui-chip">Compartir en WhatsApp</span>
      </div>
      <p className="lp-ui-note">Cualquiera con el enlace ve tus servicios y tus horas libres.</p>
    </>
  );
}

function BookedState() {
  return (
    <>
      <p className="lp-ui-title">Tu cita está reservada</p>
      <dl className="lp-ui-dl">
        <dt>Cuándo</dt><dd>Jueves, 10:30</dd>
        <dt>Servicio</dt><dd>Corte + barba · 50 min</dd>
        <dt>Profesional</dt><dd>Camilo</dd>
        <dt>Precio</dt><dd>$ 40.000</dd>
      </dl>
      <span className="lp-ui-chip" data-active>Añadir a mi calendario</span>
    </>
  );
}

function ReminderState() {
  return (
    <>
      <p className="lp-ui-title">WhatsApp · miércoles, 10:30</p>
      <div className="lp-wa">
        <p className="lp-wa-from">{DEMO_SHOP}</p>
        <p>Hola, Laura. Te esperamos mañana jueves a las 10:30 para tu Corte + barba con Camilo. ¿Necesitas cambiarla? Hazlo aquí: apptuservicio.vercel.app/cita/…</p>
      </div>
    </>
  );
}
