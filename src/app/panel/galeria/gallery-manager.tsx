"use client";

import { useRef, useState, useTransition } from "react";
import { addGalleryPhoto, deleteGalleryPhoto } from "@/app/actions/photos";
import { Img } from "@/components/photo";
import { cx } from "@/components/ui";
import { isShrinkImageError, shrinkImage } from "@/components/shrink-image";

type Photo = { id: string; url: string; author: string | null; canDelete: boolean };

export function GalleryManager({ photos, max }: { photos: Photo[]; max: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const full = photos.length >= max;

  const run = (key: string, action: () => Promise<{ ok: true } | { error: string }>) => {
    setError(null);
    setBusy(key);
    start(async () => {
      try {
        const result = await action();
        if ("error" in result) setError(result.error);
      } catch (error) {
        setError(isShrinkImageError(error) ? error.message : "No se pudo guardar la foto. Inténtalo de nuevo.");
      } finally {
        setBusy(null);
        if (input.current) input.current.value = "";
      }
    });
  };

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-[15px]">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {!full && (
          <li>
            <label
              className={cx(
                "press aspect-square rounded-2xl border-2 border-dashed border-accent-line bg-accent-soft text-accent-ink grid place-items-center text-center cursor-pointer p-3",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-line",
                pending && "opacity-60 pointer-events-none",
              )}
            >
              <span>
                <span className="block text-[32px] leading-none" aria-hidden>
                  +
                </span>
                <span className="block font-semibold mt-2">{busy === "add" ? "Subiendo…" : "Añadir foto"}</span>
                <span className="block text-[13px] opacity-80 mt-0.5">JPG, PNG o WebP · máx. 25 MB</span>
              </span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  run("add", async () => {
                    const photo = await shrinkImage(file);
                    const data = new FormData();
                    data.set("photo", photo);
                    return addGalleryPhoto(data);
                  });
                }}
              />
            </label>
          </li>
        )}
        {photos.map((p) => (
          <li key={p.id} className="relative">
            <Img src={p.url} alt={p.author ? `Trabajo de ${p.author}` : "Foto del negocio"} className="aspect-square w-full rounded-2xl" />
            {busy === p.id && <span className="absolute inset-0 rounded-2xl bg-surface/60 animate-pulse" aria-hidden />}
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-2">
              {p.author && (
                <span className="min-w-0 truncate rounded-full bg-black/55 text-white text-[12px] font-medium px-2.5 py-1">
                  {p.author}
                </span>
              )}
              {p.canDelete && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("¿Borrar esta foto de la galería?")) run(p.id, () => deleteGalleryPhoto(p.id));
                  }}
                  className="press ml-auto shrink-0 size-9 rounded-full bg-surface/95 text-danger grid place-items-center shadow-soft disabled:opacity-50"
                  aria-label="Borrar foto"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {full && <p className="text-sm text-muted mt-4">La galería está llena. Borra alguna foto para añadir otra.</p>}
      {photos.length === 0 && <p className="text-muted mt-4">Aún no hay fotos. Las que subas aparecerán en tu página de reservas.</p>}
    </>
  );
}
