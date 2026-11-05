import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Button, Card, Field, Notice, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { PageSkeleton } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { formatDayShort } from "@/lib/time";

export const metadata: Metadata = { title: "Clientes" };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function CustomersPage(props: Props) {
  return <Suspense fallback={<PageSkeleton rows={5} />}><CustomersContent {...props} /></Suspense>;
}

async function CustomersContent({ searchParams }: Props) {
  const context = await requireShop();
  if (!context.isOwner && !context.barberId) return <Notice>Tu cuenta no está vinculada a ningún barbero. Pídeselo al dueño.</Notice>;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const requestedPage = typeof params.p === "string" ? Number(params.p) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const customers = await listCustomers(context, q, page);
  const href = (p: number) => `/panel/clientes?${new URLSearchParams({ q, p: String(p) })}`;
  return <>
    <PageTitle title="Clientes" />
    <form action="/panel/clientes" method="get" className="flex items-end gap-3 mb-6">
      <div className="flex-1"><Field label="Buscar por nombre o teléfono"><input key={q} type="search" name="q" defaultValue={q} className={inputClass} /></Field></div>
      <Button type="submit">Buscar</Button>
    </form>
    {customers.length === 0 ? <Card className="p-6 text-center">{q ? `No hay clientes que coincidan con «${q}».` : "Aún no hay clientes."}</Card> :
      <ul className="grid gap-2">{customers.slice(0, 50).map(c => <li key={c.id}>
        <Link href={`/panel/clientes/${c.id}`} className="press block rounded-2xl focus-visible:outline-2 focus-visible:outline-accent-line">
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3 hover:border-accent-line">
            <div className="min-w-0"><p className="font-semibold break-words">{c.name}</p><p className="text-sm text-muted">{c.phone || "Sin teléfono"}</p></div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div><p>{c.visits} visitas atendidas</p><p className="text-muted">{c.lastVisit ? `Última visita: ${formatDayShort(c.lastVisit, context.shop.timezone)}` : "Sin visitas"}</p></div>
              {c.noShows > 0 && <Badge className="bg-danger-soft! text-danger!">{c.noShows} no vino</Badge>}
            </div>
          </Card>
        </Link>
      </li>)}</ul>}
    <nav aria-label="Paginación de clientes" className="flex items-center justify-between gap-3 mt-5">
      {page > 1 ? <Link href={href(page - 1)} className={buttonClass("secondary")}>Anterior</Link> : <span />}
      <span className="text-sm text-muted">Página {page}</span>
      {customers.length > 50 ? <Link href={href(page + 1)} className={buttonClass("secondary")}>Siguiente</Link> : <span />}
    </nav>
  </>;
}
