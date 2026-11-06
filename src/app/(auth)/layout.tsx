import Link from "next/link";

// Formulario en tarjeta a la izquierda; en escritorio, el degradado de la marca a la derecha.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
      <div>
        <Link href="/" className="press inline-block text-[22px] font-bold tracking-[-0.02em] mb-8 lg:mb-10">
          AppTu<span className="font-medium text-muted">Servicio</span>
        </Link>
        <main className="bg-surface rounded-2xl border border-line shadow-card p-6 sm:p-9 max-w-[480px]">{children}</main>
      </div>
      <div
        aria-hidden
        className="grain grain-panel hidden lg:flex items-end h-[min(780px,calc(100svh-80px))] rounded-3xl p-12 text-white"
      >
        <p className="font-display text-[44px] leading-[1.05] max-w-[12ch] text-[#0d1b33] dark:text-white">
          Tus clientes reservan solos.
        </p>
      </div>
    </div>
  );
}
