"use client";

import { useState } from "react";

const FEATURES = [
  { text: "Recuerda cada cita por WhatsApp.", detail: "Un día antes, con un enlace para cancelar: si alguien no puede ir, la hora se libera sola." },
  { text: "Nunca da la misma hora dos veces.", detail: "La hora se comprueba al confirmar. Si dos clientes la eligen a la vez, solo uno se la lleva." },
  { text: "Respeta la hora del almuerzo.", detail: "Cada día admite varias franjas, por ejemplo de 9:00 a 13:00 y de 14:00 a 19:00." },
  { text: "Cierra tus días de vacaciones.", detail: "Bloqueas días enteros o unas horas por profesional y desaparecen de la reserva." },
  { text: "Da a cada profesional su agenda.", detail: "Cada uno con su horario, su WhatsApp para los avisos y sus propias citas." },
];

/**
 * Cada capacidad es una frase con un interruptor real. Encendida, la franja
 * se llena de color y explica qué cambia para el negocio.
 */
export function Switches() {
  const [on, setOn] = useState<boolean[]>(() => FEATURES.map((_, i) => i < 2));
  const toggle = (index: number) => setOn((current) => current.map((v, i) => (i === index ? !v : v)));

  return (
    <ul className="lp-bands">
      {FEATURES.map((f, i) => (
        <li key={f.text} className="lp-band" data-on={on[i]} data-tone={i % 4}>
          <div className="lp-band-inner">
            <div>
              <p className="lp-band-text">{f.text}</p>
              <p id={`band-${i}`} className="lp-band-detail" hidden={!on[i]}>{f.detail}</p>
            </div>
            <button type="button" role="switch" aria-checked={on[i]} aria-label={f.text} aria-describedby={`band-${i}`} data-ui
              className="lp-switch" onClick={() => toggle(i)}>
              <span className="lp-switch-knob" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
