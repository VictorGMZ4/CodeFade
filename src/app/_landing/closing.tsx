"use client";

import { useState } from "react";
import { slugify } from "@/lib/format";

const PLACEHOLDER = "El Bigote";

/**
 * La frase final tiene un hueco para el nombre del negocio; a la derecha se
 * ve al instante el enlace de reservas que tendría. Envía al registro con el
 * nombre escrito (formulario GET normal, funciona sin JavaScript).
 */
export function Closing() {
  const [name, setName] = useState("");
  const shown = name.trim() || PLACEHOLDER;
  const slug = slugify(shown) || "tu-negocio";

  return (
    <div className="lp-closing">
      <form action="/registro" method="get" className="lp-blank" data-reveal>
        <p>
          <label htmlFor="cta-name">Mi negocio se llama</label>{" "}
          <input id="cta-name" name="barberia" required pattern=".*\S.*" maxLength={60} placeholder={PLACEHOLDER}
            autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} />{" "}
          y quiero mi agenda <button type="submit">ya</button>
        </p>
        <p className="lp-note">Te llevamos al registro con el nombre escrito. Es gratis.</p>
      </form>
      <div className="lp-closing-stage" data-reveal>
        <div data-ui className="lp-ui lp-closing-ui">
          <p className="lp-ui-title">{shown}</p>
          <p className="lp-ui-note">Tu enlace de reservas</p>
          <p className="lp-ui-link">apptuservicio.vercel.app/b/{slug}</p>
          <div className="lp-ui-chips">
            <span className="lp-ui-chip" data-active>Copiar enlace</span>
            <span className="lp-ui-chip">Compartir en WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
