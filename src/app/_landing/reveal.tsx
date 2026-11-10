"use client";

import { useEffect } from "react";

/**
 * Marca como pendientes los bloques [data-reveal] que aún no se ven y los
 * muestra al entrar en pantalla. Sin JavaScript todo queda visible.
 */
export function Reveal() {
  useEffect(() => {
    const blocks = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    for (const b of blocks) {
      if (b.dataset.reveal === "in") continue;
      // Lo que ya está en pantalla se muestra sin esperar (también si quedó
      // pendiente de una visita anterior); lo de más abajo entra al llegar.
      if (b.getBoundingClientRect().top <= window.innerHeight) {
        b.dataset.reveal = "in";
        continue;
      }
      b.dataset.reveal = "pending";
      io.observe(b);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
