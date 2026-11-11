import Link from "next/link";

// Formulario en tarjeta a la izquierda; en computador, el bloque azul noche de la marca a la derecha.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
      <div>
        <Link href="/" className="press inline-block text-[22px] font-bold tracking-[-0.02em] mb-8 lg:mb-10">
          AppTuServicio
        </Link>
        <main className="brand-card p-6 sm:p-9 max-w-[480px]">{children}</main>
      </div>
      <div aria-hidden className="brand-night hidden lg:flex items-end h-[min(780px,calc(100svh-80px))] p-12">
        <p className="brand-display brand-volt-text text-[clamp(56px,6vw,88px)]">
          Tus clientes reservan solos
        </p>
      </div>
    </div>
  );
}
