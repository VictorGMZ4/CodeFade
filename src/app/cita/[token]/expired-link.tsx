import Link from "next/link";
import { buttonClass } from "@/components/ui";

export function ExpiredLink({ slug }: { slug: string }) {
  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="brand-card p-6 sm:p-8">
        <h1 className="brand-display brand-display-md">Este enlace ya caducó</h1>
        <p className="text-muted mt-2">
          La cita ya terminó, así que sus datos ya no están disponibles aquí. Si quieres volver, puedes reservar otra.
        </p>
        <Link href={`/b/${slug}`} className={buttonClass("primary", "mt-6 w-full sm:w-auto")}>
          Reservar otra cita
        </Link>
      </div>
    </main>
  );
}

