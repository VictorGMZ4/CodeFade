"use client";

import { useNow } from "./use-now";

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

/** Hora actual en Bogotá; en el HTML estático se ve solo la ciudad. */
export function BogotaClock() {
  const now = useNow();
  return <>{now === null ? "Hecho en Colombia" : `Son las ${timeFormat.format(now)} en Bogotá`}</>;
}
