import { Archivo } from "next/font/google";

// La misma Archivo de la portada: 900 para titulares, 700 para títulos de tarjeta, 400–600 para el resto.
export const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "900"], variable: "--font-lp" });
