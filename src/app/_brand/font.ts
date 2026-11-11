import { Archivo } from "next/font/google";

// La misma Archivo de la portada: 900 para titulares, 400–600 para el resto.
export const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "900"], variable: "--font-lp" });
