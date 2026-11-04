import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default function ChangePasswordPage() {
  return <Suspense fallback={<p>Cargando…</p>}><ChangePasswordContent /></Suspense>;
}

async function ChangePasswordContent() {
  const user = await getUser();
  if (!user) redirect("/ingresar");
  return <>
    <PageTitle title="Cambia tu contraseña" description="Elige una contraseña personal para acceder al panel." />
    <PasswordForm />
  </>;
}
