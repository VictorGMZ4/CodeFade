import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { Stripe } from "@/components/stripe";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatDuration, minutesToHHMM, WEEKDAYS } from "@/lib/time";
import { BookingFlow } from "./booking-flow";

const getShop = cache((slug: string) =>
  db.shop.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { createdAt: "asc" } },
      barbers: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, workingHours: { select: { weekday: true, startMin: true, endMin: true } } },
      },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/b/[slug]">): Promise<Metadata> {
  const shop = await getShop((await params).slug);
  if (!shop) return {};
  return {
    title: { absolute: `Reserva en ${shop.name}` },
    description: `Elige servicio, barbero y hora en ${shop.name}.`,
  };
}

export default function BookingPage(props: PageProps<"/b/[slug]">) {
  return (
    <Suspense
      fallback={
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6">
          <PageSkeleton />
        </main>
      }
    >
      <BookingPageContent {...props} />
    </Suspense>
  );
}

/** Horario de la barbería por día: desde la primera apertura hasta el último cierre del equipo. */
function openingHours(barbers: { workingHours: { weekday: number; startMin: number; endMin: number }[] }[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const ranges = barbers.flatMap((b) => b.workingHours.filter((h) => h.weekday === weekday));
    if (!ranges.length) return { weekday, text: "Cerrado" };
    const open = Math.min(...ranges.map((r) => r.startMin));
    const close = Math.max(...ranges.map((r) => r.endMin));
    return { weekday, text: `${minutesToHHMM(open)} – ${minutesToHHMM(close)}` };
  });
}

function HoursList({ hours }: { hours: { weekday: number; text: string }[] }) {
  return (
    <dl className="mt-2 grid grid-cols-[88px_1fr] gap-y-1 text-[15px] tabular-nums">
      {hours.map((h) => (
        <div key={h.weekday} className="contents">
          <dt>{WEEKDAYS[h.weekday]}</dt>
          <dd className={h.text === "Cerrado" ? "text-muted" : ""}>{h.text}</dd>
        </div>
      ))}
    </dl>
  );
}

async function BookingPageContent({ params, searchParams }: PageProps<"/b/[slug]">) {
  const { slug } = await params;
  const { servicio } = await searchParams;
  const shop = await getShop(slug);
  if (!shop) notFound();

  const ready = shop.services.length > 0 && shop.barbers.length > 0;
  const hours = openingHours(shop.barbers);

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16 lg:items-start">
      <header className="bg-surface lg:sticky lg:top-3 mb-10 lg:mb-0">
        <Stripe />
        <div className="px-5 sm:px-7 pt-6 pb-7">
          <h1 className="font-display text-[clamp(34px,4vw,44px)]">{shop.name}</h1>
          {shop.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-block mt-3 underline underline-offset-4 decoration-1"
            >
              {shop.address}
            </a>
          )}
          {shop.phone && (
            <p className="mt-1">
              <a href={`tel:${shop.phone}`} className="press underline underline-offset-4 decoration-1">
                {shop.phone}
              </a>
            </p>
          )}
          {/* En el móvil el horario se pliega para llegar antes a la reserva */}
          <details className="mt-5 lg:hidden group">
            <summary className="press text-[15px] font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Horario <span className="text-muted group-open:hidden">· ver</span>
            </summary>
            <HoursList hours={hours} />
          </details>
          <div className="hidden lg:block mt-5">
            <p className="text-[15px] font-medium">Horario</p>
            <HoursList hours={hours} />
          </div>
        </div>
      </header>

      <div className="px-1 sm:px-0 lg:pt-6">
        {ready ? (
          <BookingFlow
            slug={shop.slug}
            initialServiceId={typeof servicio === "string" ? servicio : undefined}
            services={shop.services.map((s) => ({
              id: s.id,
              name: s.name,
              duration: formatDuration(s.durationMin),
              price: formatPrice(s.priceCents, shop.currency),
            }))}
            barbers={shop.barbers.map(({ id, name }) => ({ id, name }))}
            timezone={shop.timezone}
          />
        ) : (
          <p className="bg-surface p-6">
            Esta barbería todavía no tiene reservas online disponibles.
            {shop.phone && (
              <>
                {" "}
                Llama al{" "}
                <a href={`tel:${shop.phone}`} className="underline">
                  {shop.phone}
                </a>
                .
              </>
            )}
          </p>
        )}
        <p className="text-[13px] text-muted pb-10 -mt-24">
          Reservas con{" "}
          <Link href="/" className="underline underline-offset-2">
            Turno
          </Link>
        </p>
      </div>
    </main>
  );
}
