"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export type StagePhoto = { id: string; src: string; alt: string; position?: string };

/**
 * El escenario fijo: una fotografía a toda altura que cambia, con un fundido
 * lento, cuando llega la sección que le corresponde ([data-stage="<id>"]).
 */
export function Stage({ photos, children }: { photos: StagePhoto[]; children?: ReactNode }) {
  const [active, setActive] = useState(photos[0].id);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-stage]")];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible.at(-1)!.target.getAttribute("data-stage")!);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-field">
      {photos.map((p, i) => (
        <div key={p.id} className="stage-photo absolute inset-0" data-active={p.id === active}>
          <Image
            src={p.src}
            alt={p.alt}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="drift object-cover"
            style={{ objectPosition: p.position ?? "center" }}
          />
        </div>
      ))}
      {children}
    </div>
  );
}
