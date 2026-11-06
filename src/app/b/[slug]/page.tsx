import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
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
    description: `Elige servicio, profesional y hora en ${shop.name}.`,
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
    <dl className="mt-3 grid grid-cols-[96px_1fr] gap-y-1.5 text-[15px] tabular-nums">
      {hours.map((h) => (
        <div key={h.weekday} className="contents">
          <dt>{WEEKDAYS[h.weekday]}</dt>
          <dd className={h.text === "Cerrado" ? "text-muted/70" : "text-muted"}>{h.text}</dd>
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
    <main className="flex-1 w-full max-w-[1100px] mx-auto px-3 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] lg:pt-10 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-8 lg:items-start">
      <header className="bg-surface rounded-2xl border border-line shadow-soft p-5 sm:p-7 lg:sticky lg:top-6 mb-4 lg:mb-0">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid place-items-center size-12 shrink-0 rounded-xl bg-brand text-brand-ink text-[20px] font-bold">
            {shop.name.slice(0, 1)}
          </span>
          <h1 className="font-display text-[24px] sm:text-[28px] leading-tight">{shop.name}</h1>
        </div>
        <div className="mt-4 grid gap-1 text-[15px]">
          {shop.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press text-muted hover:text-accent-ink underline underline-offset-4 decoration-line"
            >
              {shop.address}
            </a>
          )}
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="press text-muted hover:text-accent-ink underline underline-offset-4 decoration-line">
              {shop.phone}
            </a>
          )}
        </div>
        {/* En el móvil el horario se pliega para llegar antes a la reserva */}
        <details className="mt-4 lg:hidden group">
          <summary className="press text-[15px] font-semibold text-accent-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Ver horario <span className="group-open:hidden">›</span>
          </summary>
          <HoursList hours={hours} />
        </details>
        <div className="hidden lg:block mt-6 pt-5 border-t border-line">
          <p className="text-[15px] font-semibold">Horario</p>
          <HoursList hours={hours} />
        </div>
      </header>

      <div>
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
          <p className="bg-surface rounded-2xl border border-line p-6">
            Este negocio todavía no tiene reservas online disponibles.
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
        <p className="text-[13px] text-muted text-center pb-10 -mt-24">
          Reservas con{" "}
          <Link href="/" className="underline underline-offset-2">
            AppTuServicio
          </Link>
        </p>
      </div>
    </main>
  );
}
