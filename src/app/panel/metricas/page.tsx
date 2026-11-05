import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Button, Card, Field, Notice, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { PageSkeleton } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { comparison, getMetrics, metricsBarber, percentage, resolvePeriod, type MetricsParams } from "@/lib/metrics";
import { formatPrice } from "@/lib/format";
import { MetricsChart } from "./charts";

export const metadata: Metadata = { title: "Métricas" };
/** "1 cita atendida" / "3 citas atendidas" */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function MetricsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton rows={6} />}><MetricsContent {...props} /></Suspense>;
}
async function MetricsContent({ searchParams }: Props) {
  const context = await requireShop();
  if (!context.isOwner && !context.barberId) return <Notice>Tu cuenta no está vinculada a ningún barbero. Pídeselo al dueño.</Notice>;
  const raw = await searchParams;
  const params: MetricsParams = Object.fromEntries(["periodo", "desde", "hasta", "barbero"].map(key => [key, typeof raw[key] === "string" ? raw[key] : undefined]));
  const barbers = context.isOwner ? await db.barber.findMany({ where: { shopId: context.shop.id }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }) : [];
  let error: string | undefined;
  let period: ReturnType<typeof resolvePeriod> | undefined;
  try { period = resolvePeriod(params, context.shop.timezone); } catch (e) { error = e instanceof Error ? e.message : "Revisa las fechas del rango."; }
  const selected = metricsBarber(context, params.barbero);
  if (context.isOwner && selected && !barbers.some(b => b.id === selected)) error = "El barbero seleccionado no pertenece a tu equipo.";
  const activePeriod = period?.period ?? "rango";
  const href = (value: string) => `/panel/metricas?${new URLSearchParams({ periodo: value, ...(selected && context.isOwner ? { barbero: selected } : {}), ...(value === "rango" ? { desde: params.desde || period?.from || "", hasta: params.hasta || period?.to || "" } : {}) })}`;
  const filters = <form action="/panel/metricas" method="get" className="mb-6 grid gap-4">
    <nav aria-label="Periodo de las métricas" className="flex flex-wrap gap-2">{[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["rango", "Rango"]].map(([value, label]) => <Link key={value} href={href(value)} aria-current={activePeriod === value ? "page" : undefined} className={buttonClass(activePeriod === value ? "primary" : "secondary", "px-3!")}>{label}</Link>)}</nav>
    <input type="hidden" name="periodo" value={activePeriod} />
    <div className="flex flex-wrap items-end gap-3">
      {activePeriod === "rango" && <><div className="min-w-0 flex-1"><Field label="Desde"><input key={`from-${params.desde}`} className={inputClass} type="date" name="desde" defaultValue={params.desde} required aria-invalid={!!error} /></Field></div><div className="min-w-0 flex-1"><Field label="Hasta" hint="Máximo 366 días"><input key={`to-${params.hasta}`} className={inputClass} type="date" name="hasta" defaultValue={params.hasta} required aria-invalid={!!error} /></Field></div></>}
      {context.isOwner && <div className="w-full sm:w-auto sm:min-w-52"><Field label="Barbero"><select key={selected} className={inputClass} name="barbero" defaultValue={selected ?? ""}><option value="">Todo el equipo</option>{barbers.map(b => <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (inactivo)"}</option>)}</select></Field></div>}
      {(context.isOwner || activePeriod === "rango") && <Button type="submit">Aplicar</Button>}
    </div>
  </form>;
  if (error || !period) return <><PageTitle title="Métricas del negocio" />{filters}<Notice tone="error">{error}</Notice></>;
  const data = await getMetrics(context, params, period);
  const c = data.current, p = data.previous;
  const money = (n: number) => formatPrice(n, context.shop.currency);
  const cards = [
    { label: "Reservas", value: c.reservations, detail: `${c.online} online · ${count(c.manual, "manual", "manuales")}`, change: comparison(c.reservations, p.reservations) },
    { label: "Ingresos realizados", value: money(c.revenue), detail: count(c.completed, "cita atendida", "citas atendidas"), change: comparison(c.revenue, p.revenue) },
    { label: "Ingresos previstos", value: money(c.expected), detail: count(c.booked, "cita pendiente", "citas pendientes") },
    { label: "Ticket promedio", value: c.completed ? money(Math.round(c.revenue / c.completed)) : "—", detail: "Por cita atendida" },
    { label: "No vino", value: c.noShow, detail: `${percentage(c.noShow, c.completed + c.noShow)} de atendidas + no vino` },
    { label: "Cancelaciones", value: c.cancelled, detail: `${percentage(c.cancelled, c.total)} de todas las citas` },
    { label: "Ocupación", value: c.occupancy === null ? "—" : `${Math.round(c.occupancy)}%`, detail: `${Math.round(c.minutes)} min de citas / ${Math.round(c.available)} min de trabajo`, change: comparison(c.occupancy, p.occupancy) },
    { label: "Clientes nuevos", value: c.newCustomers, detail: count(c.customers - c.newCustomers, "recurrente", "recurrentes"), change: comparison(c.newCustomers, p.newCustomers) },
  ];
  return <>
    <PageTitle title="Métricas del negocio" description={`Fechas en ${context.shop.timezone}`} />
    {filters}
    <p className="text-sm text-muted mb-4">{period.from} — {period.to} · Comparado con {period.previous.from} — {period.previous.to} ({period.days} días).</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">{cards.map(card => <Card key={card.label} className="p-5 min-w-0"><h2 className="text-sm text-muted">{card.label}</h2><p className="font-display text-3xl break-words tabular-nums mt-2">{card.value}</p><p className="text-sm text-muted mt-2">{card.detail}</p>{card.change !== undefined && <p className="text-sm text-ink mt-3" aria-label={`Comparación con el periodo anterior: ${card.change}`}>{card.change} <span className="text-muted">vs. periodo anterior</span></p>}</Card>)}</div>
    <div className="grid lg:grid-cols-2 gap-4">
      <MetricsChart key={`days-${period.from}-${period.to}-${selected}`} title={period.days > 62 ? "Citas por semana" : "Citas por día"} empty={c.reservations === 0} series={[{ label: "Atendidas", color: 1 }, { label: "Pendientes", color: 3 }, { label: "No vino", color: 2 }]} rows={data.daily.map(r => ({ label: period.days > 62 ? `Semana del ${r.day}` : r.day, shortLabel: `${r.day.slice(8)}/${r.day.slice(5, 7)}`, values: [r.completed, r.booked, r.noShow] }))} />
      <MetricsChart key={`revenue-${period.from}-${period.to}-${selected}`} title="Ingresos por barbero" horizontal currency={context.shop.currency} empty={c.total === 0} series={[{ label: "Ingresos realizados", color: 1 }]} rows={data.revenue.map(r => ({ label: r.name, values: [r.revenue] }))} />
      <MetricsChart key={`services-${period.from}-${period.to}-${selected}`} title="Servicios más pedidos" horizontal empty={data.services.length === 0} series={[{ label: "Citas", color: 1 }]} rows={data.services.map(r => ({ label: r.name, values: [r.count], detail: money(r.revenue) }))} />
      <MetricsChart key={`hours-${period.from}-${period.to}-${selected}`} title="Horas más ocupadas" empty={data.hourly.length === 0} series={[{ label: "Citas", color: 1 }]} rows={data.hourly.map(r => ({ label: `${String(r.hour).padStart(2, "0")}:00`, values: [r.count] }))} />
    </div>
  </>;
}
