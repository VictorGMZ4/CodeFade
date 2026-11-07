"use client";

import { useRef, useState, useTransition, type ComponentProps } from "react";
import { cx } from "@/components/ui";

type Result = { ok: true } | { error: string };

/**
 * Imagen subida por el negocio. Usamos <img> porque las fotos ya llegan
 * recortadas y comprimidas a WebP desde el servidor.
 */
export function Img({ className, alt, ...props }: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading="lazy" decoding="async" className={cx("object-cover", className)} {...props} />;
}

const shapes = {
  round: "size-24 rounded-full",
  square: "size-24 rounded-2xl",
  wide: "w-full aspect-[8/3] rounded-2xl",
};

/** Vista previa con botones para subir, cambiar o quitar una foto. */
export function PhotoPicker({
  label,
  hint,
  url,
  fallback,
  shape,
  upload,
  remove,
  fields,
}: {
  label: string;
  hint: string;
  url: string | null;
  fallback: string;
  shape: keyof typeof shapes;
  upload: (formData: FormData) => Promise<Result>;
  remove?: () => Promise<Result>;
  fields?: Record<string, string>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = preview ?? url;

  const run = (action: () => Promise<Result>) => {
    setError(null);
    start(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      setPreview(null);
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className={cx("grid gap-3", shape !== "wide" && "sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5")}>
      <div className={cx("relative overflow-hidden bg-raised border border-line grid place-items-center shrink-0", shapes[shape])}>
        {shown ? (
          <Img src={shown} alt="" className="absolute inset-0 size-full" />
        ) : (
          <span className="text-muted font-bold text-[28px]" aria-hidden>
            {fallback}
          </span>
        )}
        {pending && <span className="absolute inset-0 bg-surface/60 animate-pulse" aria-hidden />}
      </div>
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted mt-0.5">{hint}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <label className={cx("press inline-flex items-center justify-center h-10 px-4 rounded-lg text-[15px] font-semibold cursor-pointer bg-brand text-brand-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-line", pending && "opacity-50 pointer-events-none")}>
            {pending ? "Guardando…" : url ? "Cambiar foto" : "Subir foto"}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(URL.createObjectURL(file));
                const data = new FormData();
                data.set("photo", file);
                for (const [k, v] of Object.entries(fields ?? {})) data.set(k, v);
                run(() => upload(data));
              }}
            />
          </label>
          {url && remove && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(remove)}
              className="press h-10 px-4 rounded-lg text-[15px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
