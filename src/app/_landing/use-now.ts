"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, MINUTE_MS / 2);
  return () => window.clearInterval(id);
}

/** Minuto actual redondeado, para que el valor sea estable entre renders. */
const minuteNow = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/**
 * Hora del visitante en el navegador; en el servidor (portada estática) es
 * null y cada fragmento muestra su versión sin JavaScript.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, () => null);
}
