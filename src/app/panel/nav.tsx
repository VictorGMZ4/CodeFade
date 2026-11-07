"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/panel", label: "Agenda", icon: CalendarIcon },
  { href: "/panel/clientes", label: "Clientes", icon: CustomersIcon },
  { href: "/panel/metricas", label: "Métricas", icon: MetricsIcon },
  { href: "/panel/equipo", label: "Equipo", icon: PeopleIcon },
  { href: "/panel/servicios", label: "Servicios", icon: ScissorsIcon },
  { href: "/panel/ajustes", label: "Ajustes", icon: GearIcon },
  { href: "/panel/galeria", label: "Galería", icon: PhotoIcon },
] as const;

type Variant = { variant: "top" | "bottom"; role: "OWNER" | "STAFF"; barberId: string | null };

// La ruta actual solo se conoce en tiempo de petición: mientras llega se
// muestran los enlaces sin marcar ninguno como activo.
export function PanelNav(props: Variant) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <CurrentNav {...props} />
    </Suspense>
  );
}

function CurrentNav(props: Variant) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ variant, pathname, role, barberId }: Variant & { pathname: string | null }) {
  const links = role === "OWNER" ? LINKS : [LINKS[0], LINKS[1], LINKS[2], ...(barberId ? [{ href: `/panel/equipo/${barberId}`, label: "Mi horario", icon: CalendarIcon }, LINKS[6]] : [])];
  const isActive = (href: string) =>
    pathname !== null && (href === "/panel" ? pathname === href : pathname.startsWith(href));

  if (variant === "top") {
    return (
      <ul className="flex gap-1">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cx(
                "press block rounded-lg px-3 py-1.5 text-sm",
                isActive(href) ? "bg-brand text-brand-ink font-semibold" : "text-muted hover:text-ink hover:bg-raised",
              )}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cx("grid", role === "OWNER" ? "grid-cols-5" : barberId ? "grid-cols-5" : "grid-cols-3")}>
      {(role === "OWNER" ? links.slice(0, 4) : links).map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cx(
              "press flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 text-[11px] font-medium",
              isActive(href) ? "text-ink font-bold" : "text-muted",
            )}
          >
            <span className={cx("grid place-items-center h-8 w-14 rounded-full", isActive(href) && "bg-brand text-brand-ink")}>
              <Icon />
            </span>
            {label}
          </Link>
        </li>
      ))}
      {role === "OWNER" && <li className="relative"><MoreMenu key={pathname} active={isActive("/panel/servicios") || isActive("/panel/ajustes") || isActive("/panel/galeria")} pathname={pathname} /></li>}
    </ul>
  );
}

function MoreMenu({ active, pathname }: { active: boolean; pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={cx("press w-full flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 text-[11px] font-medium", active ? "text-ink font-bold" : "text-muted")}>
      <span className={cx("grid place-items-center h-8 w-14 rounded-full", active && "bg-brand text-brand-ink")}>
        <svg {...iconProps}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
      </span>
      Más
    </button>
    {open && <ul id={id} aria-label="Más opciones" className="absolute bottom-full right-2 mb-2 w-44 rounded-xl border border-line bg-surface shadow-card p-1">
      {LINKS.slice(4).map(({ href, label }) => <li key={href}><Link href={href} onClick={() => setOpen(false)} aria-current={pathname?.startsWith(href) ? "page" : undefined} className={cx("block rounded-lg px-4 py-3 text-sm", pathname?.startsWith(href) ? "bg-brand font-semibold text-brand-ink" : "hover:bg-raised")}>{label}</Link></li>)}
    </ul>}
  </div>;
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function MetricsIcon() {
  return <svg {...iconProps}><path d="M3 3v18h18M6 15l4-5 4 3 6-8" /></svg>;
}

function ScissorsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8 8.2 20 18M8 15.8 20 6" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c.7-3.2 3-5 6-5s5.3 1.8 6 5" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.8c1.7.6 3 2.2 3.5 4.7" />
    </svg>
  );
}

function CustomersIcon() {
  return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="10" cy="9" r="2.5" /><path d="M5.5 17c.6-2.2 2.1-3.5 4.5-3.5s3.9 1.3 4.5 3.5M17 8h1M17 12h1M17 16h1" /></svg>;
}

function PhotoIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
