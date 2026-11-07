import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { Bar } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { PanelNav } from "./nav";
import { NotificationBell } from "./notification-bell";

// El marco es estático; el nombre y la navegación se resuelven con la sesión.
export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/panel" className="font-display text-lg truncate">
            <Suspense fallback={<Bar className="h-5 w-32" />}>
              <ShopName />
            </Suspense>
          </Link>
          <div className="hidden md:block flex-1">
            <Suspense fallback={<Link href="/panel">Agenda</Link>}><SessionNav variant="top" /></Suspense>
          </div>
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            <Suspense fallback={null}><SessionNotices /></Suspense>
            <form action={logout}>
              <button className="press text-sm text-muted hover:text-ink">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
        {children}
      </main>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <Suspense fallback={<Link href="/panel" className="block p-3 text-center">Agenda</Link>}><SessionNav variant="bottom" /></Suspense>
      </nav>
    </div>
  );
}

async function ShopName() {
  const { shop, user, hasWhatsApp } = await requireShop();
  if (user.mustChangePassword) redirect("/cambiar-contrasena");
  if (!hasWhatsApp) redirect("/completar-whatsapp");
  return shop.name;
}

async function SessionNotices() {
  const { barberId } = await requireShop();
  return barberId ? <NotificationBell key={barberId} /> : null;
}

async function SessionNav({ variant }: { variant: "top" | "bottom" }) {
  const { role, barberId } = await requireShop();
  return <PanelNav variant={variant} role={role} barberId={barberId} />;
}
