import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-[clamp(38px,4vw,58px)] mb-10">Hola de nuevo</h1>
      <LoginForm />
      <p className="text-[15px] mt-8">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="underline underline-offset-4">
          Crea tu barbería
        </Link>
      </p>
    </>
  );
}
