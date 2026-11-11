import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageSkeleton } from "@/components/skeleton";
import { Notice, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { canReschedule, RESCHEDULE_REASONS } from "@/lib/reschedule";
import { formatDayLong, formatTime } from "@/lib/time";
import { ExpiredLink } from "../expired-link";
import { RescheduleFlow } from "./reschedule-flow";

export const metadata: Metadata = { title: "Reprogramar tu cita", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default function ReschedulePage(props: Props) {
  return <Suspense fallback={<main className="flex-1 w-full max-w-lg mx-auto px-4 pt-8"><PageSkeleton rows={2} /></main>}>
    <RescheduleContent {...props} />
  </Suspense>;
}

async function RescheduleContent({ params }: Props) {
  const { token } = await params;
  const a = await db.appointment.findUnique({
    where: { manageToken: token }, include: { shop: true, service: true, barber: true },
  });
  if (!a) notFound();
  const now = new Date();
  if (a.endsAt <= now) return <ExpiredLink slug={a.shop.slug} />;
  const allowed = canReschedule(a, a.shop, now);
  const barbers = allowed.ok ? await db.barber.findMany({
    where: { shopId: a.shopId, active: true }, select: { id: true, name: true, photoUrl: true }, orderBy: { name: "asc" },
  }) : [];
  return <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
    <h1 className="brand-display brand-display-xl mb-5">Reprogramar tu cita</h1>
    {allowed.ok ? <>
      <p className="text-muted mb-6">Ahora: {formatDayLong(a.startsAt, a.shop.timezone)}, {formatTime(a.startsAt, a.shop.timezone)} · {a.service.name} con {a.barber.name}</p>
      <RescheduleFlow token={token} timezone={a.shop.timezone} currentBarberId={barbers.some((b) => b.id === a.barberId) ? a.barberId : ""} barbers={barbers} />
    </> : <Notice>{RESCHEDULE_REASONS[allowed.reason]}</Notice>}
    <Link href={`/cita/${token}`} className={buttonClass("ghost", "mt-4 w-full")}>Volver a tu cita</Link>
  </main>;
}
