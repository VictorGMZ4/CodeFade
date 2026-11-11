import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return <main className="flex-1 flex items-center justify-center bg-paper px-4 py-16">
    <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-card p-6 sm:p-9">
      <p className="text-muted mb-3">404</p>
      <h1 className="brand-display brand-display-md mb-4">No encontramos esta página</h1>
      <p className="text-muted mb-6">El enlace puede haber cambiado o la página ya no está disponible.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary")}>Ir al inicio</Link>
        <Suspense fallback={null}><PanelLink /></Suspense>
      </div>
    </div>
  </main>;
}

async function PanelLink() {
  const user = await getUser();
  return user ? <Link href="/panel" className={buttonClass("secondary")}>Ir al panel</Link> : null;
}

