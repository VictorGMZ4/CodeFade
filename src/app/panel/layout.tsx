import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { Bar } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { PanelNav } from "./nav";

// El marco del panel es estático; solo el nombre de la barbería depende de la sesión.
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
            <PanelNav variant="top" />
          </div>
          <form action={logout} className="ml-auto md:ml-0">
            <button className="press text-sm text-muted hover:text-ink">Salir</button>
          </form>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
        {children}
      </main>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <PanelNav variant="bottom" />
      </nav>
    </div>
  );
}

async function ShopName() {
  const { shop } = await requireShop();
  return shop.name;
}
