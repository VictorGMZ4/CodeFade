import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Stripe } from "@/components/stripe";
import { buttonClass } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import credits from "@/lib/photo-credits.json";
import { formatDuration } from "@/lib/time";
import { LiveBooking } from "./_landing/live-booking";
import { Reveal } from "./_landing/reveal";
import { Stage, type StagePhoto } from "./_landing/stage";
import { StartDialog } from "./_landing/start-dialog";

const DEMO_SLUG = "demo";

const STAGE: StagePhoto[] = [
  { id: "corte", src: "/fotos/corte.jpg", alt: "Un barbero repasa la nuca de un cliente con peine y máquina", position: "50% 40%" },
  { id: "mesa", src: "/fotos/mesa.jpg", alt: "Mesa de trabajo de una barbería: peines, cepillos, tijeras y talco" },
  { id: "poste", src: "/fotos/poste.jpg", alt: "Poste de barbero de rayas rojas, blancas y azules junto a una puerta", position: "40% 45%" },
];

const FAQ = [
  ["¿Tengo que instalar algo?", "No. Turno funciona en el navegador del móvil o del ordenador, para ti y para tus clientes."],
  ["¿Mis clientes necesitan crear una cuenta?", "No. Reservan con su nombre y su WhatsApp, y reciben un enlace para ver o cancelar la cita."],
  ["¿Qué pasa si dos clientes eligen la misma hora?", "Solo uno se la lleva. El horario se comprueba al confirmar y al otro cliente se le pide que elija otro."],
  ["¿Puedo tener varios barberos?", "Sí. Cada uno tiene su horario y su agenda, y el cliente puede elegir con quién o dejar que le toque el primero libre."],
  ["¿Y la hora del almuerzo?", "Cada día admite varias franjas, por ejemplo de 9:00 a 13:00 y de 14:00 a 19:00. En la pausa no se puede reservar."],
  ["¿Puedo cerrar unos días por vacaciones?", "Sí. Bloqueas días enteros o unas horas para cada barbero y esos huecos desaparecen de la reserva."],
  ["¿Cómo llega el recordatorio?", "Por WhatsApp y, si el cliente dejó su correo, también por email. Tú decides con cuántas horas de antelación."],
  ["¿Y si quiero escribirle yo al cliente?", "Desde la agenda abres el chat de WhatsApp con un toque, con el mensaje de la cita ya escrito."],
  ["¿Puedo cambiar los precios?", "Cuando quieras. Las citas ya reservadas conservan el precio con el que se hicieron."],
  ["¿En qué países funciona?", "En cualquiera. Al crear la barbería eliges el país y Turno usa su hora, su moneda y su prefijo telefónico."],
];

// La portada es estática; solo la comprobación de sesión y la reserva de
// ejemplo llegan en streaming.
async function RedirectIfSignedIn() {
  if (await getUser()) redirect("/panel");
  return null;
}

async function DemoBooking() {
  const shop = await db.shop.findUnique({
    where: { slug: DEMO_SLUG },
    include: { services: { where: { active: true }, orderBy: { createdAt: "asc" }, take: 4 } },
  });
  if (!shop || shop.services.length === 0) return null;
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
    <div className="bg-paper p-6 w-full">
      <p className="font-display text-[26px]">Barbería El Bigote</p>
      <Link href={`/b/${DEMO_SLUG}`} className="inline-block mt-3 underline underline-offset-4">
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

      {/* Mitad fija con la fotografía y la reserva en vivo; mitad que se lee */}
      <div className="p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3 lg:items-start">
        <div className="relative h-[40svh] md:h-[38svh] lg:h-[calc(100svh-24px)] lg:sticky lg:top-3 lg:col-start-2 lg:row-start-1">
          <Stage photos={STAGE}>
            <div className="hidden lg:block absolute left-6 bottom-6 w-[min(400px,calc(100%-48px))]">
              <Suspense fallback={<BookingFallback />}>
                <DemoBooking />
              </Suspense>
            </div>
          </Stage>
        </div>

        <div className="relative -mt-6 lg:mt-0 lg:col-start-1 lg:row-start-1 grid grid-cols-[minmax(0,1fr)] gap-3">
          <header className="bg-surface text-ink lg:min-h-[calc(100svh-24px)] flex flex-col overflow-hidden" data-stage="corte">
            <Stripe className="text-ink" />
            <nav className="flex items-center gap-6 px-6 sm:px-10 pt-6 text-[15px]">
              <span className="font-display text-[28px] mr-auto">Turno</span>
              <a href="#como-funciona" className="press hidden sm:inline hover:underline underline-offset-4">
                Cómo funciona
              </a>
              <a href="#preguntas" className="press hidden sm:inline hover:underline underline-offset-4">
                Preguntas
              </a>
              <Link href="/ingresar" className="press hover:underline underline-offset-4">
                Ingresar
              </Link>
            </nav>
            <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 pt-10 pb-12 lg:py-14">
              <h1 className="font-display text-[clamp(38px,5vw,84px)] max-w-[16ch]">Reservas online para tu barbería</h1>
              <p className="text-[21px] leading-[1.45] mt-8 max-w-[34ch]">
                Tus clientes eligen servicio, barbero y hora desde el móvil. Tú ves la agenda del equipo y Turno les
                recuerda la cita por WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-8 gap-y-4 mt-10">
                <Link href="/registro" className={buttonClass("primary", "h-14 px-7")}>
                  Crear mi barbería
                </Link>
                <Link href={`/b/${DEMO_SLUG}`} className="press underline underline-offset-4 decoration-1">
                  Reservar en la barbería de ejemplo
                </Link>
              </div>
            </div>
          </header>

          {/* En el móvil la reserva en vivo va justo después de la portada */}
          <div className="lg:hidden">
            <Suspense fallback={<BookingFallback />}>
              <DemoBooking />
            </Suspense>
          </div>

          <HowItWorks />
          <Features />
        </div>
      </div>

      <FromChatToAgenda />
      <Neighbourhood />
      <Questions />
      <Closing host={host} />
      <Footer />
    </>
  );
}

// ── Así funciona: el recorrido impreso como un ticket ─────────────────────

const ITINERARY: { when: string; rows: [string, string][] }[] = [
  {
    when: "Lunes",
    rows: [
      ["Añades servicios, precios y horarios", "5 min"],
      ["Pegas tu enlace en la bio de Instagram", "1 min"],
    ],
  },
  {
    when: "Martes, 21:40",
    rows: [
      ["Laura reserva corte + barba para el sábado", "1 min"],
      ["La cita aparece en tu agenda", "al instante"],
    ],
  },
  {
    when: "Viernes, 10:30",
    rows: [["A Laura le llega el recordatorio por WhatsApp", "24 h antes"]],
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" data-stage="mesa" className="bg-field text-field-ink px-6 sm:px-10 py-20 scroll-mt-3">
      <div data-reveal className="grid gap-10">
        <div>
          <h2 className="font-display text-[clamp(36px,4vw,58px)] max-w-[12ch]">Así se llena la silla</h2>
          <p className="mt-6 max-w-[34ch]">
            Desde que compartes el enlace hasta que el cliente se sienta, nadie tiene que contestar el teléfono.
          </p>
        </div>
        <div
          className="bg-paper text-ink px-6 pt-4 pb-12 text-[15px] tabular-nums max-w-[480px] w-full"
          style={{
            clipPath:
              "polygon(0 0, 100% 0, 100% calc(100% - 12px), 95% 100%, 90% calc(100% - 12px), 85% 100%, 80% calc(100% - 12px), 75% 100%, 70% calc(100% - 12px), 65% 100%, 60% calc(100% - 12px), 55% 100%, 50% calc(100% - 12px), 45% 100%, 40% calc(100% - 12px), 35% 100%, 30% calc(100% - 12px), 25% 100%, 20% calc(100% - 12px), 15% 100%, 10% calc(100% - 12px), 5% 100%, 0 calc(100% - 12px))",
          }}
        >
          {ITINERARY.map((group) => (
            <div key={group.when} className="mt-6">
              <p className="font-medium">{group.when}</p>
              <ul className="mt-2 grid gap-2">
                {group.rows.map(([what, time]) => (
                  <li key={what} className="flex items-end gap-2">
                    <span className="min-w-0">{what}</span>
                    <span aria-hidden className="flex-1 min-w-4 mb-[6px] border-b-[3px] border-dotted border-muted/70" />
                    <span className="shrink-0 text-muted whitespace-nowrap">{time}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-7 -mx-6 bg-ink text-paper px-6 py-3 flex items-center justify-between gap-4 font-medium">
            <span>Sábado 10:30 · Laura en la silla</span>
            <span className="whitespace-nowrap">0 llamadas</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Lo que hace: pequeñas pruebas de la interfaz junto al texto ───────────

function Features() {
  return (
    <section data-stage="poste" className="bg-surface px-6 sm:px-10 py-20">
      <h2 className="font-display text-[clamp(36px,4vw,58px)] mb-14">Lo que Turno hace por ti</h2>
      <div className="grid gap-20">
        <Feature
          title="Nunca dos clientes a la misma hora"
          text="Cada horario se comprueba al confirmar. Si dos personas eligen el mismo hueco a la vez, solo una se lo lleva y la otra elige otra hora."
        >
          <div className="grid grid-cols-4 gap-1.5 text-[15px] font-medium tabular-nums">
            {["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45"].map((t, i) => (
              <span
                key={t}
                className={
                  i === 2
                    ? "h-10 grid place-items-center bg-ink text-paper"
                    : i === 4 || i === 5
                      ? "h-10 grid place-items-center text-muted line-through"
                      : "h-10 grid place-items-center bg-paper"
                }
              >
                {t}
              </span>
            ))}
          </div>
        </Feature>
        <Feature
          title="Horarios de verdad, con almuerzo"
          text="Cada barbero tiene sus días y sus franjas. Las vacaciones y los permisos se bloquean en un momento y desaparecen de la reserva."
        >
          <dl className="grid grid-cols-[52px_1fr] gap-y-2 text-[15px] tabular-nums">
            {[
              ["Lun", "09:00 – 13:00 · 14:00 – 19:00"],
              ["Mar", "09:00 – 13:00 · 14:00 – 19:00"],
              ["Sáb", "08:00 – 14:00"],
              ["Dom", "Descansa"],
            ].map(([d, h]) => (
              <div key={d} className="contents">
                <dt className="font-medium">{d}</dt>
                <dd className={h === "Descansa" ? "text-muted" : ""}>{h}</dd>
              </div>
            ))}
          </dl>
        </Feature>
        <Feature
          title="El recordatorio sale solo"
          text="Por WhatsApp, con las horas de antelación que elijas y un enlace para cancelar. Si alguien no puede venir, el hueco vuelve a quedar libre."
        >
          <div className="max-w-[300px] bg-[#d9fdd3] text-[#111b21] px-3 py-2 text-[15px] leading-snug">
            Hola Laura, te recordamos tu cita en Barbería El Bigote el sábado 7 de noviembre a las 10:30. Gestiónala
            aquí: <span className="text-[#03628c] underline">/cita/vnvx…</span>
            <span className="block text-right text-[13px] text-[#4e5e68] mt-1">10:30</span>
          </div>
        </Feature>
        <Feature
          title="La agenda del día en el bolsillo"
          text="Ves quién viene, con quién y cuánto suma el día. Marcas si fue atendido o no vino, y escribes al cliente con un toque."
        >
          <div className="bg-paper p-4 flex gap-4 text-[15px]">
            <div className="tabular-nums">
              <p className="font-medium">14:30</p>
              <p className="text-muted">15:20</p>
            </div>
            <div className="min-w-0">
              <p className="font-medium">Laura Gómez</p>
              <p className="text-muted">Corte + barba · Camilo · $ 40.000</p>
              <p className="mt-1.5 flex gap-4 font-medium">
                <span className="text-ok">WhatsApp</span>
                <span>Atendida</span>
                <span className="text-muted">No vino</span>
              </p>
            </div>
          </div>
        </Feature>
      </div>
    </section>
  );
}

function Feature({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div data-reveal className="grid gap-5 2xl:grid-cols-[minmax(0,360px)_1fr] 2xl:gap-8">
      <div data-ui className="bg-raised p-5 self-start">
        {children}
      </div>
      <div className="max-w-[38ch]">
        <h3 className="text-[21px] font-medium leading-snug">{title}</h3>
        <p className="mt-2">{text}</p>
      </div>
    </div>
  );
}

// ── Del chat a la agenda: lo que llega y lo que queda ─────────────────────

function FromChatToAgenda() {
  const chat = [
    ["Julián", "Hermano, ¿hay turno hoy a las 5?"],
    ["Mateo", "¿Camilo trabaja mañana?"],
    ["Julián", "Mejor a las 6, ¿puede ser?"],
    ["Santiago", "Para el niño también, el sábado"],
    ["Laura", "Perdón, hoy no llego"],
  ];
  const agenda = [
    ["10:00", "Julián Pérez", "Corte + barba", "Andrés"],
    ["11:00", "Mateo Rojas", "Arreglo de barba", "Camilo"],
    ["15:00", "Santiago Díaz", "Corte niño", "Andrés"],
    ["18:00", "Julián Pérez", "Corte clásico", "Camilo"],
  ];
  return (
    <section className="grid md:grid-cols-2 mt-3" aria-labelledby="chat-agenda">
            <div className="bg-field text-field-ink min-h-[62svh] md:min-h-[90svh] px-6 sm:px-10 py-16 flex flex-col">
        <ul data-reveal className="grid gap-3 max-w-[34ch] text-[21px] leading-snug md:mt-[12svh]">
          {chat.map(([who, msg], i) => (
            <li key={i}>
              <span className="text-field-muted">{who}: </span>
              {msg}
            </li>
          ))}
        </ul>
        <h2 id="chat-agenda" className="font-display text-[clamp(38px,5vw,84px)] mt-auto pt-12">
          Del chat<span className="sr-only"> a la agenda</span>
        </h2>
      </div>
      <div className="bg-paper min-h-[62svh] md:min-h-[90svh] px-6 sm:px-10 py-16 flex flex-col">
        <p aria-hidden className="font-display text-[clamp(38px,5vw,84px)] md:order-last md:mt-auto md:pt-12 md:text-right">
          a la agenda
        </p>
        <div data-reveal className="mt-10 md:mt-[12svh]">
          <ol data-ui className="bg-surface p-4 grid gap-1.5 w-full max-w-[520px] text-[15px]">
            <li className="px-1 pb-2 flex justify-between font-medium">
              <span>Martes 3 de noviembre</span>
              <span className="text-muted tabular-nums">4 citas · $ 103.000</span>
            </li>
            {agenda.map(([t, name, service, barber]) => (
              <li key={t} className="bg-paper px-3 py-2.5 grid grid-cols-[52px_1fr] gap-3">
                <span className="font-medium tabular-nums">{t}</span>
                <span className="min-w-0">
                  <span className="block font-medium truncate">{name}</span>
                  <span className="block text-muted truncate">
                    {service} · {barber}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── Para la barbería del barrio ───────────────────────────────────────────

function Neighbourhood() {
  return (
    <section className="px-3 pt-36 pb-12">
      <div data-reveal className="px-3 sm:px-7 grid gap-6 lg:grid-cols-2 lg:items-end mb-12">
        <h2 className="font-display text-[clamp(36px,4vw,58px)] max-w-[12ch]">Para la barbería del barrio</h2>
        <p className="text-[21px] leading-[1.45] max-w-[40ch]">
          Hecho para negocios de una a seis sillas, con clientes de siempre, el fútbol en la tele y la agenda llena
          los sábados. Sin contratos ni equipos especiales: el móvil que ya tienes.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <figure>
          <Image
            src="/fotos/don-isaac.jpg"
            alt="Fachada azul de la Peluquería y Barbería Don Isaac, con postes de barbero pintados junto a la puerta"
            width={1920}
            height={2560}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="w-full h-[70svh] md:h-[110svh] object-cover"
          />
          <figcaption className="text-[15px] text-muted mt-2 px-1">Peluquería y Barbería Don Isaac, Zacatelco, Tlaxcala</figcaption>
        </figure>
        <div className="grid gap-3 md:grid-rows-[auto_1fr]">
          <div className="bg-field text-field-ink p-8 sm:p-10">
            <h3 className="font-display text-[28px] max-w-[16ch]">Tu enlace, donde ya te buscan</h3>
            <p className="mt-4 max-w-[36ch]">
              En la bio de Instagram, en el estado de WhatsApp, en tu ficha de Google Maps o impreso junto al espejo.
            </p>
          </div>
          <figure className="flex flex-col">
            <Image
              src="/fotos/pajonal.jpg"
              alt="Barbería en una calle de San Antonio Pajonal, con fachada naranja y rótulo negro"
              width={1920}
              height={1080}
              sizes="(min-width: 768px) 45vw, 100vw"
              className="w-full h-[40svh] md:h-auto md:flex-1 md:min-h-0 object-cover object-[25%_80%]"
            />
            <figcaption className="text-[15px] text-muted mt-2 px-1">Barbería y salón, San Antonio Pajonal</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

// ── Preguntas: leídas de corrido ──────────────────────────────────────────

function Questions() {
  return (
    <section id="preguntas" className="px-6 sm:px-10 pt-36 pb-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] scroll-mt-6">
      <h2 className="font-display text-[clamp(36px,4vw,58px)]">Preguntas</h2>
      <div data-reveal className="lg:columns-2 lg:gap-14 [&>p]:break-inside-avoid">
        {FAQ.map(([q, a]) => (
          <p key={q} className="mb-5 leading-[1.55]">
            <span className="font-medium">{q}</span> {a}
          </p>
        ))}
      </div>
    </section>
  );
}

// ── Cierre: el primer paso ya abierto ─────────────────────────────────────

function Closing({ host }: { host: string }) {
  return (
    <section className="mx-3 mt-24 bg-field text-field-ink min-h-[84svh] md:min-h-[90svh] grid md:grid-cols-2 gap-10 px-4 sm:px-10 py-12 md:py-10">
      <div className="flex flex-col md:justify-end">
        <h2 className="font-display text-[clamp(38px,5vw,84px)] max-w-[10ch]">Abre tu agenda hoy</h2>
        <p className="mt-6 text-[21px] leading-[1.45] max-w-[34ch]">
          Creas la cuenta, añades tus servicios y compartes el enlace. Desde ese momento tus clientes pueden reservar.
        </p>
      </div>
      <div className="flex items-end md:items-center md:justify-center">
        <StartDialog host={host} />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 sm:px-10 pt-32 pb-8 text-[15px]">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-baseline">
        <p className="text-muted">Turno · agenda para barberías</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/registro" className="press hover:underline underline-offset-4">Crear cuenta</Link>
          <Link href="/ingresar" className="press hover:underline underline-offset-4">Ingresar</Link>
          <Link href={`/b/${DEMO_SLUG}`} className="press hover:underline underline-offset-4">Reserva de ejemplo</Link>
        </nav>
        <p className="text-muted md:text-right">2026</p>
      </div>
      <p className="text-[13px] text-muted mt-6 max-w-[120ch]">
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
