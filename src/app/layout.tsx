import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";

// Bodoni: la letra de los vidrios pintados de las barberías clásicas.
const display = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const text = Jost({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Turno · Agenda para barberías", template: "%s · Turno" },
  description: "Reservas online, agenda y recordatorios para barberías.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecebe7" },
    { media: "(prefers-color-scheme: dark)", color: "#12150b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${text.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
