import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, PageTitle } from "@/components/ui";
import { PageSkeleton } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { customerDetails } from "@/lib/customers";
import { formatPrice } from "@/lib/format";
import { formatDayLong, formatTime } from "@/lib/time";
import { whatsappLink } from "@/lib/notify";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Ficha de cliente" };
type Props = { params: Promise<{ id: string }> };
const statuses = {
  BOOKED: { label: "Reservada", style: "bg-accent-soft! text-accent-ink!" },
  COMPLETED: { label: "Atendida", style: "bg-ok-soft! text-ok!" },
  CANCELLED: { label: "Cancelada", style: "bg-raised! text-muted!" },
  NO_SHOW: { label: "No vino", style: "bg-danger-soft! text-danger!" },
};

export default function CustomerPage(props: Props) {
  return <Suspense fallback={<PageSkeleton rows={5} />}><CustomerContent {...props} /></Suspense>;
}

async function CustomerContent({ params }: Props) {
  const context = await requireShop();
  const { id } = await params;
  const { customer, statuses: totals, dates, barber, appointments } = await customerDetails(context, id);
  const count = (status: string) => totals.find(s => s.status === status)?._count._all ?? 0;
  const spent = totals.find(s => s.status === "COMPLETED")?._sum.priceCents ?? 0;
  const { shop } = context;
  const figures = [
    ["Visitas atendidas", count("COMPLETED")], ["Total gastado", formatPrice(spent, shop.currency)],
    ["No vino", count("NO_SHOW")], ["Canceladas", count("CANCELLED")],
    ["Profesional habitual", barber?.name ?? "—"],
    ["Cliente desde", dates._min.startsAt ? formatDayLong(dates._min.startsAt, shop.timezone) : "—"],
  ];
  return <>
    <Link href="/panel/clientes" className="inline-block py-2 mb-3 text-sm text-accent-ink">‹ Clientes</Link>
    <PageTitle title={customer.name} />
    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6 text-sm">
      {customer.phone ? <>
        <span>{customer.phone}</span>
        <a href={whatsappLink(customer.phone, `Hola ${customer.name}, te escribimos de ${shop.name}.`)} target="_blank" rel="noopener noreferrer" className="text-ok font-semibold">WhatsApp</a>
        <a href={`tel:${customer.phone}`} className="text-accent-ink font-semibold">Llamar</a>
      </> : <span className="text-muted">Sin teléfono</span>}
      {customer.email && <span className="break-all">{customer.email}</span>}
    </div>
    <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">{figures.map(([label, value]) => <Card key={label} className="p-4 min-w-0"><dt className="text-sm text-muted">{label}</dt><dd className="font-semibold mt-1 break-words">{value}</dd></Card>)}</dl>
    <Card className="p-4 sm:p-5 mb-6"><NoteForm key={customer.id} id={customer.id} notes={customer.notes} /></Card>
    <h2 className="font-display text-xl mb-3">Historial</h2>
    {dates._count > 50 && <p className="text-sm text-muted mb-3">Mostrando las 50 citas más recientes.</p>}
    {appointments.length === 0 ? <Card className="p-5">Aún no hay citas.</Card> : <ol className="grid gap-2">{appointments.map(a => <li key={a.id}>
      <Card className="p-4 flex flex-wrap justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold">{formatDayLong(a.startsAt, shop.timezone)} · {formatTime(a.startsAt, shop.timezone)}</p><p className="text-sm text-muted break-words">{a.service.name} · {a.barber.name} · {formatPrice(a.priceCents, shop.currency)}</p></div>
        <div className="flex items-center gap-2"><Badge className={statuses[a.status].style}>{statuses[a.status].label}</Badge>{a.source === "MANUAL" && <Badge>Manual</Badge>}</div>
      </Card>
    </li>)}</ol>}
  </>;
}
