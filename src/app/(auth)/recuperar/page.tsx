import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoveryPage() {
  return <>
    <h1 className="font-display text-[30px] sm:text-[34px] mb-4">Recupera tu contraseña</h1>
    <p className="text-muted mb-6">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
    <RecoveryForm />
    <Link href="/ingresar" className="inline-block mt-6 text-accent-ink underline underline-offset-4">Volver a ingresar</Link>
  </>;
}
