import Image from "next/image";
import Link from "next/link";

// Formulario en tarjeta a la izquierda; en escritorio, una barbería a la derecha.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
      <div>
        <Link href="/" className="press inline-block font-display text-[22px] mb-8 lg:mb-10">
          CodeFade
        </Link>
        <main className="bg-surface rounded-2xl border border-line shadow-card p-6 sm:p-9 max-w-[480px]">{children}</main>
      </div>
      <div className="hidden lg:block relative h-[min(780px,calc(100svh-80px))] rounded-3xl overflow-hidden">
        <Image
          src="/fotos/mesa.jpg"
          alt="Mesa de trabajo de una barbería: peines, cepillos, tijeras y talco"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
