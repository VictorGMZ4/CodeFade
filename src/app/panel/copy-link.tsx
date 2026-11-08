"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  // APP_URL puede no estar definido: completamos con el origen actual.
  const full = url.startsWith("/") ? origin + url : url;

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    setError(null);
    setCopied(false);
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url: full });
        return;
      }
      await navigator.clipboard.writeText(full);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError")) setError("No se pudo compartir. Selecciona y copia el enlace manualmente.");
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-2 max-w-md mx-auto">
      <code className="flex-1 min-w-0 truncate rounded-lg bg-paper border border-line px-3 py-2.5 text-sm text-left select-all">
        {full}
      </code>
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "¡Copiado!" : "Compartir enlace"}
      </Button>
      <span aria-live="polite" className="sr-only">{copied ? "Enlace copiado" : ""}</span>
      {error && <p role="alert" className="basis-full text-sm text-danger">{error}</p>}
    </div>
  );
}
