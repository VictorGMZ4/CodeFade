import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Notice } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Restablecer contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" };
type Props = { params: Promise<{ token: string }> };

export default function ResetPage({ params }: Props) {
  return <Suspense fallback={<p>Cargando…</p>}><ResetContent params={params} /></Suspense>;
}

async function ResetContent({ params }: Props) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return <>
    <Notice tone="error">Este enlace ya no es válido. Pide uno nuevo.</Notice>
    <Link href="/recuperar" className="inline-block mt-6 text-accent-ink underline underline-offset-4">Pedir un enlace nuevo</Link>
  </>;
  return <>
    <h1 className="font-display text-[30px] sm:text-[34px] mb-6">Crea una contraseña nueva</h1>
    <ResetForm token={token} />
  </>;
}
