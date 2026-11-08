"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { cx } from "@/components/ui";

type Notices = Awaited<ReturnType<typeof getNotifications>>;

function elapsed(createdAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / 1440);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function NotificationBell() {
  const [data, setData] = useState<Notices>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const panelId = useId();

  const refresh = useCallback(async () => {
    const request = ++version.current;
    try {
      const next = await getNotifications();
      if (!mounted.current || request !== version.current) return;
      setData(next); setNow(Date.now()); setLoaded(true); setError("");
    } catch {
      if (mounted.current && request === version.current) setError("No se pudieron cargar los avisos. Vuelve a intentarlo.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    function visibility() {
      clearInterval(timer);
      if (document.visibilityState === "hidden") return;
      void refresh();
      timer = setInterval(() => { void refresh(); }, 30_000);
    }
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function mark(id?: string) {
    setBusy(true);
    version.current++;
    try {
      if (id) await markNotificationRead(id);
      else await markAllNotificationsRead();
      await refresh();
    } catch {
      if (mounted.current) setError("No se pudo marcar el aviso. Vuelve a intentarlo.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div ref={root} className="md:relative">
      <button ref={trigger} type="button" aria-label={`Avisos, ${data.unread} sin leer`} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(!open)} className="press relative flex h-11 w-11 items-center justify-center rounded-lg hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent-ink">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {data.unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 min-w-5 rounded-full bg-brand px-1 text-xs font-bold text-brand-ink">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && <section id={panelId} aria-label="Avisos" className="absolute inset-x-3 top-full mt-2 rounded-2xl border border-line bg-surface shadow-card md:inset-x-auto md:right-0 md:w-96">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="font-semibold">Avisos</h2>
          <button type="button" disabled={busy || data.unread === 0} onClick={() => void mark()} className="press min-h-11 text-sm text-accent-ink disabled:opacity-50">Marcar todos como leídos</button>
        </div>
        {error && <div role="status" className="px-4 py-2 text-sm text-danger">{error} <button type="button" onClick={() => void refresh()} className="underline">Reintentar</button></div>}
        <ul className="max-h-[min(65dvh,32rem)] overflow-y-auto overscroll-contain p-2">
          {data.items.map((item) => <li key={item.id} className={cx("mb-1 rounded-xl p-3", !item.read && "bg-accent-soft")}>
            <Link href={`/panel?dia=${item.day}`} onClick={() => { if (!item.read) void mark(item.id); setOpen(false); }} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-accent-ink">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {!item.read && <><span className="sr-only">Sin leer</span><span className="h-2 w-2 rounded-full bg-accent-ink" aria-hidden="true" /></>}
                {item.type === "MANUAL_BY_OWNER" ? "Cita agendada por el dueño" : item.type === "NEW_BOOKING" ? "Nueva reserva" : "Cancelación del cliente"}
              </div>
              <p className="mt-1 break-words font-medium">{item.customerName}</p>
              <p className="break-words text-sm text-muted">{item.serviceName}</p>
              <p className="mt-1 text-sm">{item.appointmentDay} · {item.appointmentTime}</p>
              <p className="mt-1 text-xs text-muted">{elapsed(item.createdAt, now)}</p>
            </Link>
            {!item.read && <button type="button" disabled={busy} onClick={() => void mark(item.id)} className="press mt-1 min-h-11 text-sm font-medium text-accent-ink disabled:opacity-50">Marcar como leído</button>}
          </li>)}
          {data.items.length === 0 && <li className="p-4 text-sm text-muted">{loaded ? "No tienes avisos." : "Cargando avisos…"}</li>}
        </ul>
      </section>}
    </div>
  );
}
