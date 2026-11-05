import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Notice, PageTitle } from "@/components/ui";
import { PageSkeleton } from "@/components/skeleton";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDaysToDay, isValidDay, localDay } from "@/lib/time";
import { ManualAppointmentForm } from "./manual-appointment-form";

export const metadata: Metadata = { title: "Nueva cita" };
type Props = { searchParams: Promise<{ dia?: string | string[] }> };

export default function NewAppointmentPage(props: Props) {
  return <Suspense fallback={<PageSkeleton rows={5} />}><Content {...props} /></Suspense>;
}

async function Content({ searchParams }: Props) {
  const { shop, isOwner, barberId } = await requireShop();
  const params = await searchParams;
  const today = localDay(new Date(), shop.timezone);
  const lastDay = addDaysToDay(today, 60, shop.timezone);
  const day = typeof params.dia === "string" && isValidDay(params.dia) && params.dia >= today && params.dia <= lastDay ? params.dia : today;
  const back = <Link href={`/panel?dia=${day}`} className="press inline-flex min-h-11 items-center text-sm text-accent-ink mb-3">‹ Agenda</Link>;
  if (!isOwner && !barberId) return <>{back}<Notice>Tu cuenta no está vinculada a ningún barbero. Pídeselo al dueño.</Notice></>;
  const barbers = await db.barber.findMany({
    where: { shopId: shop.id, active: true, ...(!isOwner ? { id: barberId! } : {}) },
    select: { id: true, name: true }, orderBy: { createdAt: "asc" },
  });
  const services = await db.service.findMany({
    where: { shopId: shop.id, active: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" },
  });
  return <div className="max-w-xl">
    {back}
    <PageTitle title="Nueva cita" />
    {!barbers.length ? <Notice>No hay barberos activos disponibles.</Notice> : !services.length ? <Notice>No hay servicios activos disponibles.</Notice> :
      <Card className="p-4 sm:p-6"><ManualAppointmentForm barbers={barbers} services={services} isOwner={isOwner} day={day} today={today} lastDay={lastDay} timezone={shop.timezone} /></Card>}
  </div>;
}
