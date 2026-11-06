import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-[30px] sm:text-[34px] mb-8">Hola de nuevo</h1>
      <LoginForm />
      <p className="text-[15px] text-muted mt-6">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent-ink underline underline-offset-4">
          Crea tu negocio
        </Link>
      </p>
    </>
  );
}
