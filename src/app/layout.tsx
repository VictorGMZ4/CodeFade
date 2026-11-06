import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Manrope: geométrica y muy legible en pantallas pequeñas.
const text = Manrope({
  variable: "--font-text",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "AppTuServicio · Agenda online para negocios con citas", template: "%s · AppTuServicio" },
  description: "Reservas online, agenda y recordatorios para negocios con citas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a2a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${text.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
