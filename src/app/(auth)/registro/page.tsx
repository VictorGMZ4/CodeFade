import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage(props: PageProps<"/registro">) {
  return (
    <>
      <h1 className="font-display text-[30px] sm:text-[34px]">Abre tu agenda online</h1>
      <p className="text-[17px] text-muted mt-2 mb-8">
        En unos minutos tendrás un enlace para que tus clientes reserven solos.
      </p>
      {/* El nombre puede venir escrito desde la portada (?barberia=) */}
      <Suspense fallback={<SignupForm />}>
        <PrefilledSignup {...props} />
      </Suspense>
      <p className="text-[15px] text-muted mt-6">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="font-semibold text-accent-ink underline underline-offset-4">
          Ingresa
        </Link>
      </p>
    </>
  );
}

async function PrefilledSignup({ searchParams }: PageProps<"/registro">) {
  const { barberia } = await searchParams;
  const name = typeof barberia === "string" ? barberia.slice(0, 60) : undefined;
  return <SignupForm defaultShopName={name} />;
}
