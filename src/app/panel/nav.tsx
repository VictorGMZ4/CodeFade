"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/panel", label: "Agenda", icon: CalendarIcon },
  { href: "/panel/servicios", label: "Servicios", icon: ScissorsIcon },
  { href: "/panel/equipo", label: "Equipo", icon: PeopleIcon },
  { href: "/panel/ajustes", label: "Ajustes", icon: GearIcon },
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
  const links = role === "OWNER" ? LINKS : [LINKS[0], ...(barberId ? [{ href: `/panel/equipo/${barberId}`, label: "Mi horario", icon: CalendarIcon }] : [])];
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
                isActive(href) ? "bg-accent text-accent-ink font-semibold" : "text-muted hover:text-ink",
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
    <ul className={cx("grid", role === "OWNER" ? "grid-cols-4" : barberId ? "grid-cols-2" : "grid-cols-1")}>
      {links.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cx(
              "press flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium",
              isActive(href) ? "text-accent-ink font-bold" : "text-muted",
            )}
          >
            <Icon />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
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

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
