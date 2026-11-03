import Image from "next/image";
import Link from "next/link";
import { Stripe } from "@/components/stripe";

// Formulario a la izquierda; en escritorio, la mesa de trabajo de una barbería a la derecha.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3">
      <main className="bg-surface min-h-[calc(100svh-24px)] flex flex-col">
        <Stripe />
        <div className="px-6 sm:px-10 pt-6">
          <Link href="/" className="press font-display text-[28px]">
            Turno
          </Link>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
      <div className="hidden lg:block relative h-[calc(100svh-24px)] sticky top-3 overflow-hidden">
        <Image
          src="/fotos/mesa.jpg"
          alt="Mesa de trabajo de una barbería: peines, cepillos, tijeras y talco"
          fill
          priority
          sizes="50vw"
          className="drift object-cover"
        />
      </div>
    </div>
  );
}
