"use client";

import { useId, useState } from "react";
import { DEMO_SERVICES, formatPrice, parseServiceLine } from "./demo-data";

const MAX_LINES = 6;
const START = DEMO_SERVICES.map((s) => `${s.name}, ${s.minutes} min, ${s.price}`).join("\n");

/**
 * Lo que escribe el dueño a la izquierda y la página de reservas que sale de
 * ello a la derecha. Al editar el texto, la página cambia al instante.
 */
export function ServicesDemo() {
  const id = useId();
  const [text, setText] = useState(START);
  const services = text.split("\n").slice(0, MAX_LINES).map(parseServiceLine).filter((s) => s !== null);

  return (
    <div className="lp-split">
      <div className="lp-split-in">
        <label htmlFor={id} className="lp-split-label">Tus servicios: nombre, minutos y precio, uno por línea</label>
        <textarea id={id} value={text} rows={MAX_LINES} spellCheck={false}
          onChange={(e) => setText(e.target.value.slice(0, 400))} className="lp-split-text" />
      </div>
      <div className="lp-split-out">
        <div data-ui className="lp-ui lp-page">
          <p className="lp-ui-title">Elige un servicio</p>
          {services.length === 0 ? (
            <p className="lp-ui-note">Escribe un servicio a la izquierda.</p>
          ) : (
            <ul className="lp-ui-rows">
              {services.map((s, i) => (
                <li key={`${s.id}-${i}`} className="lp-ui-row" aria-current={i === 0 || undefined}>
                  <span>
                    {s.name}
                    <span className="lp-ui-note">{s.minutes} min</span>
                  </span>
                  <span className="lp-ui-price">{s.price ? formatPrice(s.price) : "Precio a consultar"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
