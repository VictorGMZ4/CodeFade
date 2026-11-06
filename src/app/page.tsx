import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { LiveBooking } from "./_landing/live-booking";
import { Reveal } from "./_landing/reveal";
import { StartDialog } from "./_landing/start-dialog";

const DEMO_SLUG = "demo";
const SECTORS = ["Barberías", "Peluquerías", "Uñas", "Estética", "Spa"];

const FAQ = [
  ["¿Tengo que instalar algo?", "No. AppTuServicio funciona en el navegador del móvil o del ordenador, para ti y para tus clientes."],
  ["¿Mis clientes necesitan crear una cuenta?", "No. Reservan con su nombre y su WhatsApp, y reciben un enlace para ver o cancelar la cita."],
  ["¿Qué pasa si dos clientes eligen la misma hora?", "Solo uno se la lleva. El horario se comprueba al confirmar y al otro cliente se le pide que elija otro."],
  ["¿Puedo tener varios profesionales?", "Sí. Cada uno tiene su horario y su agenda, y el cliente puede elegir con quién o dejar que le toque el primero libre."],
  ["¿Y la hora del almuerzo?", "Cada día admite varias franjas, por ejemplo de 9:00 a 13:00 y de 14:00 a 19:00. En la pausa no se puede reservar."],
  ["¿Puedo cerrar unos días por vacaciones?", "Sí. Bloqueas días enteros o unas horas para cada profesional y esos huecos desaparecen de la reserva."],
  ["¿Cómo llega el recordatorio?", "Por WhatsApp y, si el cliente dejó su correo, también por email. Tú decides con cuántas horas de antelación."],
  ["¿En qué países funciona?", "En cualquiera. Al crear el negocio eliges el país y AppTuServicio usa su hora, su moneda y su prefijo telefónico."],
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
    <div className="bg-surface text-ink rounded-2xl shadow-card p-7 w-full">
      <p className="font-bold text-[18px]">Reserva de ejemplo</p>
      <p className="text-[15px] text-muted mt-1">No se puede mostrar aquí ahora mismo.</p>
      <Link href={`/b/${DEMO_SLUG}`} className="inline-block mt-4 font-semibold text-accent-ink underline underline-offset-4">
        Abrir la reserva de ejemplo
      </Link>
    </div>
  );
}

export default function Home() {
  const host = (process.env.APP_URL ?? "").replace(/^https?:\/\//, "") || "tu-dominio";

  return (
    <div className="grain flex-1">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Reveal />

      <header className="pt-[env(safe-area-inset-top)] text-white">
        <nav className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-7">
          <Link href="/" className="text-[21px] font-bold tracking-[-0.02em] mr-auto">
            AppTu<span className="font-medium opacity-75">Servicio</span>
          </Link>
          <div className="hidden md:flex gap-7 text-[15px] font-medium">
            <a href="#agenda" className="press opacity-90 hover:opacity-100">Funciones</a>
            <a href="#preguntas" className="press opacity-90 hover:opacity-100">Preguntas</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className="press h-10 px-3 inline-flex items-center rounded-lg text-[15px] font-semibold hover:bg-white/15">
              Ingresar
            </Link>
            <Link href="/registro" className={cx(whiteButton, "h-10 px-4 text-[15px] hidden sm:inline-flex")}>
              Crear mi negocio
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Portada: titular en blanco sobre el azul, reserva en vivo al lado */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-20 md:pt-14 md:pb-28 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)] lg:items-start">
          <div className="text-white">
            <h1 className="font-display text-[clamp(42px,5.4vw,74px)] leading-[1.02] max-w-[11ch]">
              Tus clientes reservan solos.
            </h1>
            <p className="text-[19px] sm:text-[20px] leading-[1.5] mt-6 max-w-[34ch] opacity-95">
              Agenda online para negocios con citas: eligen servicio, profesional y hora desde el móvil, y tú lo ves
              todo ordenado.
            </p>
            <ul className="flex flex-wrap gap-2 mt-7" aria-label="Para qué negocios">
              {SECTORS.map((s) => (
                <li key={s} className="rounded-full bg-white/16 px-3 py-1.5 text-[14px] font-medium">
                  {s}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-9">
              <Link href="/registro" className={cx(whiteButton, "inline-flex h-[52px] px-7 text-[17px]")}>
                Crear mi negocio gratis
              </Link>
              <Link
                href={`/b/${DEMO_SLUG}`}
                className="press h-[52px] px-4 inline-flex items-center justify-center font-semibold text-[17px] underline underline-offset-4"
              >
                Ver una reserva de ejemplo
              </Link>
            </div>
          </div>

          <div className="w-full max-w-[470px] lg:ml-auto">
            <Suspense fallback={<BookingFallback />}>
              <DemoBooking />
            </Suspense>
          </div>
        </section>

        <Showcase />
        <Questions />
        <Closing host={host} />
      </main>
      <Footer />
    </div>
  );
}

// Botón blanco con texto azul, para usar encima del degradado
const whiteButton =
  "press items-center justify-center rounded-lg bg-white text-[#1650b0] font-semibold hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// ── Fragmentos del producto: la agenda y las métricas ─────────────────────

function Showcase() {
  return (
    <section id="agenda" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 md:pt-16 grid gap-20 md:gap-28 scroll-mt-6">
      <Row
        title="La agenda del día, sin chats."
        text="Cada cita llega con el servicio, el profesional y el contacto del cliente. Marcas si vino y le escribes con un toque."
      >
        <p className="font-semibold">Hoy · Miércoles 11</p>
        <p className="text-[14px] text-muted">3 citas · $ 78.000 previstos</p>
        <ul className="mt-3 grid gap-2">
          {[
            ["09:00", "Laura Gómez", "Corte y peinado · Ana", "Reservada"],
            ["10:30", "Marta Ruiz", "Manicure · Sofía", "Reservada"],
            ["14:00", "Julián Pérez", "Barba · Andrés", "Manual"],
          ].map(([t, n, s, tag]) => (
            <li key={t} className="flex items-center gap-4 rounded-xl bg-raised px-4 py-3">
              <span className="font-bold tabular-nums w-12">{t}</span>
              <span className="min-w-0">
                <span className="block font-semibold truncate">{n}</span>
                <span className="block text-[14px] text-muted truncate">{s}</span>
              </span>
              <span className="ml-auto shrink-0 rounded-full bg-accent text-accent-ink px-2.5 py-0.5 text-[12px] font-semibold">
                {tag}
              </span>
            </li>
          ))}
        </ul>
      </Row>
      <Row
        title="Sabes cómo va tu negocio."
        text="Reservas, ingresos y ocupación por semana o por mes, comparados con el periodo anterior."
      >
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            ["Reservas", "86", "12%"],
            ["Ingresos", "$ 2,9 M", "8%"],
            ["Ocupación", "74%", "5%"],
          ].map(([k, v, up]) => (
            <div key={k} className="rounded-xl bg-raised p-3.5 min-w-0">
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className="text-[26px] font-bold tracking-[-0.02em] tabular-nums">{v}</dd>
              <dd className="text-[13px] font-semibold text-ok">▲ {up}</dd>
            </div>
          ))}
        </dl>
        <div aria-hidden className="mt-5 h-28 flex items-end gap-2 border-b border-line px-1">
          {[40, 62, 55, 80, 72, 95, 30, 58, 66, 88, 70, 92].map((h, i) => (
            <span key={i} className="flex-1 max-w-6 rounded-t bg-brand" style={{ height: `${h}%` }} />
          ))}
        </div>
      </Row>
    </section>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div data-reveal className="grid gap-7 md:grid-cols-[5fr_7fr] md:gap-14 md:items-center">
      <div>
        <h2 className="font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] max-w-[14ch]">{title}</h2>
        <p className="text-[18px] mt-4 max-w-[38ch] opacity-80">{text}</p>
      </div>
      <div data-ui className="bg-surface text-ink rounded-2xl shadow-card p-5 sm:p-6 min-w-0">
        {children}
      </div>
    </div>
  );
}

// ── Preguntas ─────────────────────────────────────────────────────────────

function Questions() {
  return (
    <section className="max-w-[820px] mx-auto px-4 sm:px-6 pt-20 md:pt-28">
      <div id="preguntas" data-reveal className="bg-surface text-ink rounded-2xl shadow-card scroll-mt-6">
        <div className="px-5 sm:px-7 pt-7 pb-3">
          <h2 className="font-display text-[clamp(28px,3vw,38px)]">Preguntas frecuentes</h2>
          <p className="text-muted mt-2">Lo que suelen preguntar los negocios antes de empezar.</p>
        </div>
        <div className="divide-y divide-line">
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
    <section className="px-4 sm:px-6 pt-20 md:pt-28 pb-16">
      <div className="max-w-[1200px] mx-auto rounded-3xl border border-white/35 bg-white/12 backdrop-blur-md text-white px-6 sm:px-12 py-12 md:py-16 grid gap-10 grid-cols-[minmax(0,1fr)] md:grid-cols-2 md:items-center">
        <div>
          <h2 className="font-display text-[clamp(36px,4.6vw,60px)] leading-[1.02]">Abre tu agenda hoy.</h2>
          <p className="mt-5 text-[18px] max-w-[36ch] opacity-95">
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
    <footer className="text-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-[21px] font-bold tracking-[-0.02em]">
            AppTu<span className="font-medium opacity-75">Servicio</span>
          </p>
          <p className="text-[15px] mt-2 max-w-[32ch] opacity-85">Agenda y reservas online para negocios con citas.</p>
        </div>
        <FooterLinks
          title="Producto"
          links={[
            ["#agenda", "Funciones"],
            ["#preguntas", "Preguntas"],
            [`/b/${DEMO_SLUG}`, "Reserva de ejemplo"],
          ]}
        />
        <FooterLinks
          title="Cuenta"
          links={[
            ["/registro", "Crear cuenta"],
            ["/ingresar", "Ingresar"],
          ]}
        />
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[13px] font-semibold opacity-75">{title}</p>
      <ul className="mt-3 grid gap-2 text-[15px] font-semibold">
        {links.map(([href, label]) => (
          <li key={href}>
            {href.startsWith("#") ? (
              <a href={href} className="press hover:underline underline-offset-4">{label}</a>
            ) : (
              <Link href={href} className="press hover:underline underline-offset-4">{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
