import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { Img } from "@/components/photo";
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
        select: { id: true, name: true, photoUrl: true, workingHours: { select: { weekday: true, startMin: true, endMin: true } } },
      },
      photos: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, url: true } },
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
          <dd className={h.text === "Cerrado" ? "text-field-muted/70" : "text-field-muted"}>{h.text}</dd>
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
      <header className="brand-night overflow-hidden lg:sticky lg:top-6 mb-4 lg:mb-0">
        {shop.coverUrl && <Img src={shop.coverUrl} alt="" loading="eager" className="w-full aspect-[8/3]" />}
        <div className="p-5 sm:p-7">
        <div className="flex items-center gap-3">
          {shop.logoUrl ? (
            <Img src={shop.logoUrl} alt={`Logo de ${shop.name}`} loading="eager" className={shop.coverUrl ? "size-16 shrink-0 rounded-2xl border-4 border-field -mt-12" : "size-12 shrink-0 rounded-xl"} />
          ) : (
            <span aria-hidden className="grid place-items-center size-12 shrink-0 rounded-full bg-brand text-brand-ink text-[22px] font-black">
              {shop.name.slice(0, 1)}
            </span>
          )}
        </div>
        <h1 className="brand-display brand-display-xl lg:text-[44px] mt-5">{shop.name}</h1>
        <div className="mt-5 grid gap-1 text-[15px] text-field-muted">
          {shop.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press hover:text-field-ink underline underline-offset-4 decoration-field-muted/40 w-fit"
            >
              {shop.address}
            </a>
          )}
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="press hover:text-field-ink underline underline-offset-4 decoration-field-muted/40 w-fit">
              {shop.phone}
            </a>
          )}
        </div>
        {/* En el móvil el horario se pliega para llegar antes a la reserva */}
        <details className="mt-4 lg:hidden group">
          <summary className="press brand-volt-text text-[15px] font-semibold cursor-pointer list-none w-fit [&::-webkit-details-marker]:hidden">
            Ver horario <span className="group-open:hidden">›</span>
          </summary>
          <HoursList hours={hours} />
        </details>
        <div className="hidden lg:block mt-6 pt-5 border-t border-field-ink/15">
          <p className="brand-volt-text text-[15px] font-semibold">Horario</p>
          <HoursList hours={hours} />
        </div>
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
            barbers={shop.barbers.map(({ id, name, photoUrl }) => ({ id, name, photoUrl }))}
            timezone={shop.timezone}
          />
        ) : (
          <p className="brand-card p-6 sm:p-8">
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
        {shop.photos.length > 0 && (
          <section className="relative brand-card p-5 sm:p-8 -mt-28" aria-labelledby="trabajos">
            <h2 id="trabajos" className="brand-display brand-display-md">Nuestros trabajos</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {shop.photos.map((p) => (
                <li key={p.id}>
                  <Img src={p.url} alt={`Trabajo de ${shop.name}`} className="aspect-square w-full rounded-[10px]" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className={shop.photos.length > 0 ? "text-[13px] text-muted text-center mt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]" : "text-[13px] text-muted text-center pb-10 -mt-24"}>
          Reservas con{" "}
          <Link href="/" className="underline underline-offset-2">
            AppTuServicio
          </Link>
          {" · "}
          <Link href="/privacidad" className="underline underline-offset-2">
            Privacidad
          </Link>
        </p>
      </div>
    </main>
  );
}
