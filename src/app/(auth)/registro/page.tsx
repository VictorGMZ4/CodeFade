import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage(props: PageProps<"/registro">) {
  return (
    <>
      <h1 className="font-display text-[clamp(38px,4vw,58px)]">Abre tu agenda online</h1>
      <p className="text-[21px] leading-[1.45] mt-4 mb-10">
        En unos minutos tendrás un enlace para que tus clientes reserven solos.
      </p>
      {/* El nombre puede venir escrito desde la portada (?barberia=) */}
      <Suspense fallback={<SignupForm />}>
        <PrefilledSignup {...props} />
      </Suspense>
      <p className="text-[15px] mt-8">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="underline underline-offset-4">
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
