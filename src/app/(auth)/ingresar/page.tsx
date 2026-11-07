import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/ui";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

type Props = { searchParams: Promise<{ restablecida?: string }> };

export default function LoginPage({ searchParams }: Props) {
  return (
    <>
      <h1 className="font-display text-[30px] sm:text-[34px] mb-8">Hola de nuevo</h1>
      <Suspense fallback={null}><ResetNotice searchParams={searchParams} /></Suspense>
      <LoginForm />
      <Link href="/recuperar" className="inline-block mt-5 text-accent-ink underline underline-offset-4">¿Olvidaste tu contraseña?</Link>
      <p className="text-[15px] text-muted mt-6">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent-ink underline underline-offset-4">
          Crea tu negocio
        </Link>
      </p>
    </>
  );
}

async function ResetNotice({ searchParams }: Props) {
  const { restablecida } = await searchParams;
  return restablecida === "1" ? <div className="mb-4"><Notice tone="ok">Contraseña actualizada. Ya puedes ingresar.</Notice></div> : null;
}
