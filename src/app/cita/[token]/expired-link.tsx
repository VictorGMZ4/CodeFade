import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

export function ExpiredLink({ slug }: { slug: string }) {
  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-[28px] leading-tight tracking-tight">Este enlace ya caducó</h1>
        <p className="text-muted mt-2">
          La cita ya terminó, así que sus datos ya no están disponibles aquí. Si quieres volver, puedes reservar otra.
        </p>
        <Link href={`/b/${slug}`} className={buttonClass("primary", "mt-6 w-full sm:w-auto")}>
          Reservar otra cita
        </Link>
      </Card>
    </main>
  );
}

