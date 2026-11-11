import type { ReactNode } from "react";
import { archivo } from "./font";
import "./brand.css";

/** Envoltorio de las páginas del cliente con los colores y la letra de la portada. */
export function BrandShell({ children }: { children: ReactNode }) {
  return <div className={`brand ${archivo.variable} flex-1 flex flex-col`}>{children}</div>;
}
