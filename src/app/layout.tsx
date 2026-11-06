import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Geist: neutra y muy legible en pantallas pequeñas.
const text = Geist({
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
    { media: "(prefers-color-scheme: light)", color: "#2f72d6" },
    { media: "(prefers-color-scheme: dark)", color: "#1d4fa8" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${text.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
