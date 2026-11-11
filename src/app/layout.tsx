import type { Metadata, Viewport } from "next";
import { archivo } from "./_brand/font";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AppTuServicio · Agenda online para negocios con citas", template: "%s · AppTuServicio" },
  description: "Reservas online, agenda y recordatorios para negocios con citas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Solo tono claro por ahora: la barra del navegador también clara.
  themeColor: "#eef2f8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
