import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Badge, buttonClass, cx } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import credits from "@/lib/photo-credits.json";
import { formatDuration } from "@/lib/time";
import { LiveBooking } from "./_landing/live-booking";
import { Reveal } from "./_landing/reveal";
import { StartDialog } from "./_landing/start-dialog";

const DEMO_SLUG = "demo";

const FAQ = [
  ["¿Tengo que instalar algo?", "No. Turno funciona en el navegador del móvil o del ordenador, para ti y para tus clientes."],
  ["¿Mis clientes necesitan crear una cuenta?", "No. Reservan con su nombre y su WhatsApp, y reciben un enlace para ver o cancelar la cita."],
  ["¿Qué pasa si dos clientes eligen la misma hora?", "Solo uno se la lleva. El horario se comprueba al confirmar y al otro cliente se le pide que elija otro."],
  ["¿Puedo tener varios barberos?", "Sí. Cada uno tiene su horario y su agenda, y el cliente puede elegir con quién o dejar que le toque el primero libre."],
  ["¿Y la hora del almuerzo?", "Cada día admite varias franjas, por ejemplo de 9:00 a 13:00 y de 14:00 a 19:00. En la pausa no se puede reservar."],
  ["¿Puedo cerrar unos días por vacaciones?", "Sí. Bloqueas días enteros o unas horas para cada barbero y esos huecos desaparecen de la reserva."],
  ["¿Cómo llega el recordatorio?", "Por WhatsApp y, si el cliente dejó su correo, también por email. Tú decides con cuántas horas de antelación."],
  ["¿En qué países funciona?", "En cualquiera. Al crear la barbería eliges el país y Turno usa su hora, su moneda y su prefijo telefónico."],
];

// La portada es estática; solo la comprobación de sesión y la reserva de
// ejemplo llegan en streaming. Si la base de datos falla, la portada se
// muestra igual: sin redirección y con un enlace en lugar de la reserva.
async function RedirectIfSignedIn() {
  let signedIn = false;
  try {
    signedIn = Boolean(await getUser());
  } catch (error) {
    console.error("[portada] no se pudo comprobar la sesión", error);
  }
  // redirect() lanza una excepción propia de Next, por eso va fuera del try.
  if (signedIn) redirect("/panel");
  return null;
}

async function DemoBooking() {
  let shop;
  try {
    shop = await db.shop.findUnique({
      where: { slug: DEMO_SLUG },
      include: { services: { where: { active: true }, orderBy: { createdAt: "asc" }, take: 4 } },
    });
  } catch (error) {
    console.error("[portada] no se pudo cargar la reserva de ejemplo", error);
    return <BookingFallback />;
  }
  if (!shop || shop.services.length === 0) return <BookingFallback />;
  return (
    <LiveBooking
      slug={shop.slug}
      shopName={shop.name}
      timezone={shop.timezone}
      services={shop.services.map((s) => ({
        id: s.id,
        name: s.name,
        duration: formatDuration(s.durationMin),
        price: formatPrice(s.priceCents, shop.currency),
      }))}
    />
  );
}

function BookingFallback() {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-7 w-full">
      <p className="font-bold text-[18px]">Barbería El Bigote</p>
      <p className="text-[15px] text-muted mt-1">La reserva de ejemplo no se puede mostrar aquí ahora mismo.</p>
      <Link href={`/b/${DEMO_SLUG}`} className="inline-block mt-4 font-semibold text-accent-ink underline underline-offset-4">
        Abrir la reserva de ejemplo
      </Link>
    </div>
  );
}

export default function Home() {
  const host = (process.env.APP_URL ?? "").replace(/^https?:\/\//, "") || "tu-dominio";

  return (
    <>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Reveal />

      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <nav className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-8">
          <Link href="/" className="font-display text-[22px] mr-auto">
            Turno
          </Link>
          <div className="hidden md:flex gap-7 text-[15px] font-semibold">
            <a href="#como-funciona" className="press hover:text-accent-ink">Cómo funciona</a>
            <a href="#funciones" className="press hover:text-accent-ink">Funciones</a>
            <a href="#preguntas" className="press hover:text-accent-ink">Preguntas</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className={buttonClass("ghost", "h-10 px-3 text-[15px]")}>
              Ingresar
            </Link>
            <Link href="/registro" className={buttonClass("primary", "h-10 px-4 text-[15px] hidden sm:inline-flex")}>
              Crear mi barbería
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Portada: titular a la izquierda, reserva en vivo a la derecha */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-20 md:pt-16 md:pb-28 grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <Badge>Para barberías de una a seis sillas</Badge>
            <h1 className="font-display text-[clamp(40px,5.6vw,68px)] mt-5 max-w-[14ch]">
              Reservas online para tu barbería
            </h1>
            <p className="text-[19px] sm:text-[20px] leading-[1.5] text-muted mt-6 max-w-[38ch]">
              Tus clientes eligen servicio, barbero y hora desde el móvil. Tú ves la agenda del equipo y Turno les
              recuerda la cita por WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link href="/registro" className={buttonClass("primary", "h-[52px] px-7 text-[17px]")}>
                Crear mi barbería
              </Link>
              <Link href={`/b/${DEMO_SLUG}`} className={buttonClass("secondary", "h-[52px] px-7 text-[17px]")}>
                Ver una reserva de ejemplo
              </Link>
            </div>
            <p className="text-[14px] text-muted mt-5">Sin instalar nada · Funciona desde el móvil</p>
          </div>

          <div className="relative">
            <span aria-hidden className="blob size-[280px] -top-10 -right-6 bg-[var(--blob-1)]" />
            <span aria-hidden className="blob size-[240px] -bottom-12 -left-8 bg-[var(--blob-2)]" />
            <div className="relative max-w-[480px] lg:ml-auto">
              <Suspense fallback={<BookingFallback />}>
                <DemoBooking />
              </Suspense>
            </div>
          </div>
        </section>

        <HowItWorks />
        <Features />
        <Neighbourhood />
        <Questions />
        <Closing host={host} />
      </main>
      <Footer />
    </>
  );
}

function SectionHeader({ id, title, text }: { id?: string; title: string; text: string }) {
  return (
    <div id={id} data-reveal className="text-center max-w-[680px] mx-auto scroll-mt-24">
      <h2 className="font-display text-[clamp(32px,4vw,50px)]">{title}</h2>
      <p className="text-[18px] text-muted mt-4">{text}</p>
    </div>
  );
}

// ── Así funciona: de compartir el enlace a la silla ocupada ──────────────

const STEPS: { when: string; what: string; time: string }[] = [
  { when: "Lunes", what: "Añades tus servicios, precios y horarios", time: "5 min" },
  { when: "Lunes", what: "Pegas tu enlace en la bio de Instagram", time: "1 min" },
  { when: "Martes, 21:40", what: "Laura reserva corte + barba para el sábado", time: "1 min" },
  { when: "Viernes, 10:30", what: "A Laura le llega el recordatorio por WhatsApp", time: "24 h antes" },
];

function HowItWorks() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <SectionHeader
          id="como-funciona"
          title="Así se llena la silla"
          text="Desde que compartes el enlace hasta que el cliente se sienta, nadie tiene que contestar el teléfono."
        />
        <ol data-reveal className="mt-14 max-w-[760px] mx-auto grid gap-3">
          {STEPS.map((s) => (
            <li key={s.what} className="flex items-center gap-4 rounded-2xl bg-paper px-5 py-4">
              <span className="size-2.5 shrink-0 rounded-full bg-accent-line" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-muted">{s.when}</p>
                <p className="font-semibold">{s.what}</p>
              </div>
              <span className="shrink-0 text-[14px] text-muted whitespace-nowrap">{s.time}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 rounded-2xl bg-accent text-accent-ink px-5 py-4 font-semibold">
            <span>Sábado 10:30 · Laura en la silla</span>
            <span className="whitespace-nowrap">0 llamadas</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

// ── Funciones: bloques alternos de texto y fragmento de la interfaz ───────

function Features() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <SectionHeader
          id="funciones"
          title="Lo que Turno hace por ti"
          text="Todo lo que hoy resuelves por chat, en una agenda que se ordena sola."
        />
        <div className="mt-16 grid gap-20 md:gap-28">
          <Feature
            title="Nunca dos clientes a la misma hora"
            text="Cada horario se comprueba al confirmar. Si dos personas eligen el mismo hueco a la vez, solo una se lo lleva y la otra elige otra hora."
          >
            <div className="grid grid-cols-4 gap-2 text-[15px] font-semibold tabular-nums">
              {["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45"].map((t, i) => (
                <span
                  key={t}
                  className={cx(
                    "h-11 grid place-items-center rounded-lg border",
                    i === 2
                      ? "bg-accent border-accent-line text-accent-ink"
                      : i === 4 || i === 5
                        ? "border-transparent bg-raised text-muted line-through"
                        : "border-accent-line text-accent-ink",
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          </Feature>
          <Feature
            reverse
            title="Horarios de verdad, con almuerzo"
            text="Cada barbero tiene sus días y sus franjas. Las vacaciones y los permisos se bloquean en un momento y desaparecen de la reserva."
          >
            <dl className="grid grid-cols-[56px_1fr] gap-y-3 text-[15px] tabular-nums">
              {[
                ["Lun", "09:00 – 13:00 · 14:00 – 19:00"],
                ["Mar", "09:00 – 13:00 · 14:00 – 19:00"],
                ["Sáb", "08:00 – 14:00"],
                ["Dom", "Descansa"],
              ].map(([d, h]) => (
                <div key={d} className="contents">
                  <dt className="font-semibold">{d}</dt>
                  <dd className={h === "Descansa" ? "text-muted" : ""}>{h}</dd>
                </div>
              ))}
            </dl>
          </Feature>
          <Feature
            title="El recordatorio sale solo"
            text="Por WhatsApp, con las horas de antelación que elijas y un enlace para cancelar. Si alguien no puede venir, el hueco vuelve a quedar libre."
          >
            <div className="max-w-[320px] rounded-xl rounded-tl-sm bg-[#d9fdd3] text-[#111b21] px-3.5 py-2.5 text-[15px] leading-snug">
              Hola Laura, te recordamos tu cita en Barbería El Bigote el sábado 7 de noviembre a las 10:30. Gestiónala
              aquí: <span className="text-[#03628c] underline">/cita/vnvx…</span>
              <span className="block text-right text-[13px] text-[#4e5e68] mt-1">10:30</span>
            </div>
          </Feature>
          <Feature
            reverse
            title="La agenda del día en el bolsillo"
            text="Ves quién viene, con quién y cuánto suma el día. Marcas si fue atendido o no vino, y escribes al cliente con un toque."
          >
            <div className="grid gap-2 text-[15px]">
              {[
                ["10:00", "Julián Pérez", "Corte + barba · Andrés"],
                ["14:30", "Laura Gómez", "Corte + barba · Camilo"],
                ["16:00", "Mateo Rojas", "Corte clásico · Camilo"],
              ].map(([t, n, s]) => (
                <div key={t} className="flex gap-4 rounded-xl bg-paper px-4 py-3">
                  <span className="font-semibold tabular-nums">{t}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{n}</span>
                    <span className="block text-muted truncate">{s}</span>
                  </span>
                  <span className="ml-auto self-center text-ok font-semibold">WhatsApp</span>
                </div>
              ))}
            </div>
          </Feature>
        </div>
      </div>
    </section>
  );
}

function Feature({
  title,
  text,
  reverse,
  children,
}: {
  title: string;
  text: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-reveal className="grid gap-8 md:grid-cols-2 md:gap-16 md:items-center">
      <div className={cx("max-w-[44ch]", reverse && "md:order-2")}>
        <h3 className="font-display text-[clamp(26px,2.6vw,34px)]">{title}</h3>
        <p className="text-[18px] text-muted mt-4">{text}</p>
      </div>
      <div data-ui className={cx("bg-surface rounded-2xl shadow-card p-6 sm:p-8", reverse && "md:order-1")}>
        {children}
      </div>
    </div>
  );
}

// ── Para la barbería del barrio ───────────────────────────────────────────

function Neighbourhood() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <SectionHeader
          title="Para la barbería del barrio"
          text="Hecho para negocios con clientes de siempre, el fútbol en la tele y la agenda llena los sábados. Con el móvil que ya tienes."
        />
        <div data-reveal className="mt-14 grid gap-4 md:grid-cols-3">
          <Photo src="/fotos/don-isaac.jpg" w={1920} h={2560} caption="Peluquería y Barbería Don Isaac, Zacatelco, Tlaxcala"
            alt="Fachada azul de la Peluquería y Barbería Don Isaac, con postes de barbero pintados junto a la puerta" />
          <Photo src="/fotos/corte.jpg" w={1920} h={2876} caption="Un corte con peine y máquina"
            alt="Un barbero repasa la nuca de un cliente con peine y máquina" position="50% 40%" />
          <Photo src="/fotos/pajonal.jpg" w={1920} h={1080} caption="Barbería y salón, San Antonio Pajonal"
            alt="Barbería en una calle de San Antonio Pajonal, con fachada naranja y rótulo negro" position="25% 80%" />
        </div>
      </div>
    </section>
  );
}

function Photo({ src, alt, caption, w, h, position }: { src: string; alt: string; caption: string; w: number; h: number; position?: string }) {
  return (
    <figure>
      <Image
        src={src}
        alt={alt}
        width={w}
        height={h}
        sizes="(min-width: 768px) 33vw, 100vw"
        className="w-full aspect-[4/5] object-cover rounded-3xl"
        style={{ objectPosition: position ?? "center" }}
      />
      <figcaption className="text-[14px] text-muted mt-3 px-1">{caption}</figcaption>
    </figure>
  );
}

// ── Preguntas ─────────────────────────────────────────────────────────────

function Questions() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6">
        <SectionHeader id="preguntas" title="Preguntas frecuentes" text="Lo que suelen preguntar los barberos antes de empezar." />
        <div className="mt-12 bg-surface rounded-2xl shadow-soft divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 sm:px-7">
              <summary className="press flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-semibold text-[17px] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-muted text-[22px] leading-none transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 -mt-1 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Cierre: el primer paso ya abierto ─────────────────────────────────────

function Closing({ host }: { host: string }) {
  return (
    <section className="px-4 sm:px-6 pb-20 md:pb-28">
      <div className="max-w-[1200px] mx-auto bg-field text-field-ink rounded-3xl px-6 sm:px-12 py-12 md:py-16 grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="font-display text-[clamp(34px,4.4vw,56px)]">Abre tu agenda hoy</h2>
          <p className="mt-5 text-[18px] text-field-muted max-w-[36ch]">
            Creas la cuenta, añades tus servicios y compartes el enlace. Desde ese momento tus clientes pueden reservar.
          </p>
        </div>
        <div className="flex md:justify-end">
          <StartDialog host={host} />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-surface border-t border-line">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 pb-[max(3rem,env(safe-area-inset-bottom))] grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-[22px]">Turno</p>
          <p className="text-[15px] text-muted mt-2 max-w-[32ch]">Agenda y reservas online para barberías.</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-muted">Producto</p>
          <ul className="mt-3 grid gap-2 text-[15px] font-semibold">
            <li><a href="#como-funciona" className="press hover:text-accent-ink">Cómo funciona</a></li>
            <li><a href="#funciones" className="press hover:text-accent-ink">Funciones</a></li>
            <li><Link href={`/b/${DEMO_SLUG}`} className="press hover:text-accent-ink">Reserva de ejemplo</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-muted">Cuenta</p>
          <ul className="mt-3 grid gap-2 text-[15px] font-semibold">
            <li><Link href="/registro" className="press hover:text-accent-ink">Crear cuenta</Link></li>
            <li><Link href="/ingresar" className="press hover:text-accent-ink">Ingresar</Link></li>
          </ul>
        </div>
      </div>
      <p className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-10 text-[13px] text-muted">
        Fotografías:{" "}
        {credits.map((c, i) => (
          <span key={c.file}>
            <a href={c.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {c.title}
            </a>{" "}
            — {c.creator},{" "}
            {c.licenseUrl ? (
              <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {c.license}
              </a>
            ) : (
              c.license
            )}
            {i < credits.length - 1 ? "; " : "."}
          </span>
        ))}
      </p>
    </footer>
  );
}
