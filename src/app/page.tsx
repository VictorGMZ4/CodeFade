import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Reveal } from "./_landing/reveal";
import "./_landing/landing.css";

const DEMO_SLUG = "demo";

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

const BENEFITS = [
  { color: "lp-green", icon: "✓", title: "Menos clientes que no llegan", text: "Recordatorio por WhatsApp con enlace para cancelar y liberar el hueco" },
  { color: "lp-pink", icon: "⏱", title: "Nunca dos a la misma hora", text: "Cada hora se comprueba al confirmar; solo una reserva entra" },
  { color: "lp-orange", icon: "●", title: "Tus datos, solo tuyos", text: "Contraseñas cifradas y una cuenta para cada profesional" },
];

// La portada es estática; solo la comprobación de sesión llega en streaming.
// Si la base de datos falla, la portada se muestra igual, sin redirección.
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

export default function Home() {
  return (
    <div className="lp flex-1">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Reveal />

      <header className="lp-header">
        <nav className="lp-wrap lp-nav" aria-label="Principal">
          <Link href="/" className="lp-logo">
            <span className="lp-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
            </span>
            AppTuServicio
          </Link>
          <a href="#funciones" className="lp-link hidden md:inline">Funciones</a>
          <a href="#confianza" className="lp-link hidden md:inline">Confianza</a>
          <a href="#preguntas" className="lp-link hidden md:inline">Preguntas</a>
          <Link href="/ingresar" className="lp-link text-white!">Ingresar</Link>
          <Link href="/registro" className="lp-btn lp-btn-blue hidden! sm:inline-flex! h-11! px-[18px]! text-[15px]!">
            Crear mi negocio
          </Link>
        </nav>
      </header>

      <main>
        <section id="funciones" className="lp-wrap lp-hero scroll-mt-4">
          <div>
            <span className="lp-pill"><span className="lp-dot" />Para negocios con citas</span>
            <h1 className="lp-h1">
              Tus clientes reservan <span className="lp-grad">solos.</span>
            </h1>
            <p className="lp-lead">
              Barberías, peluquerías, uñas, estética y spa: eligen servicio, profesional y hora desde el móvil, y tú lo
              ves todo ordenado.
            </p>
            <div className="lp-actions">
              <Link href="/registro" className="lp-btn lp-btn-blue">＋ Crear mi negocio gratis</Link>
              <Link href={`/b/${DEMO_SLUG}`} className="lp-btn lp-btn-glass">Ver una reserva de ejemplo</Link>
            </div>
            <ul className="lp-checks">
              {["Sin instalar nada", "Recordatorio por WhatsApp", "Sin dobles reservas"].map((c) => (
                <li key={c}>
                  <span className="lp-tick" aria-hidden>✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <AppPreview />
        </section>

        <section id="confianza" className="lp-block scroll-mt-4">
          <div data-reveal className="lp-wrap lp-sec">
            <div>
              <span className="lp-pill lp-pill-ok"><span className="lp-dot" />Confianza</span>
              <h2 className="lp-h2">
                Menos llamadas, <span className="lp-grad">menos ausencias.</span>
              </h2>
              <p className="lp-text">
                La agenda se cuida sola: comprueba cada hora antes de confirmarla y le recuerda la cita a tu cliente.
              </p>
            </div>
            <ul className="lp-frost">
              {BENEFITS.map((b) => (
                <li key={b.title} className="lp-row">
                  <span className={`lp-ico ${b.color}`} aria-hidden>
                    <span>{b.icon}</span>
                  </span>
                  <span>
                    <span className="lp-row-title">{b.title}</span>
                    <span className="lp-row-text">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="preguntas" className="lp-block scroll-mt-4">
          <div className="lp-wrap lp-faq">
            <div className="text-center">
              <span className="lp-pill"><span className="lp-dot" />Preguntas</span>
              <h2 className="lp-h2">Preguntas frecuentes</h2>
            </div>
            <div className="lp-frost mt-7">
              {FAQ.map(([q, a]) => (
                <details key={q} className="lp-row">
                  <summary className="press">
                    {q}
                    <span aria-hidden>+</span>
                  </summary>
                  <p className="lp-answer">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap pb-16">
          <div data-reveal className="lp-cta">
            <div>
              <h2 className="lp-h2 mt-0!">
                Abre tu agenda <span className="lp-grad">hoy.</span>
              </h2>
              <p className="lp-text text-[19px]!">
                Creas la cuenta, añades tus servicios y compartes el enlace. Desde ese momento tus clientes pueden reservar.
              </p>
            </div>
            <Link href="/registro" className="lp-btn lp-btn-blue">Crear mi negocio gratis</Link>
          </div>
        </section>
      </main>

      <footer className="lp-wrap">
        <div className="lp-footer">
          <span>AppTuServicio · Agenda online para negocios con citas</span>
          <span className="flex gap-4">
            <a href="#funciones">Funciones</a>
            <a href="#preguntas">Preguntas</a>
            <Link href="/ingresar">Ingresar</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

// Vista de la app con datos de ejemplo (no consulta la base de datos).
function AppPreview() {
  return (
    <div className="lp-phone lp-frost" role="img" aria-label="Ejemplo de la agenda de AppTuServicio en el móvil">
      <div className="lp-chip" aria-hidden>
        <span className="lp-ico lp-green">↗</span>
        <span>
          <b>+12%</b>
          <small>reservas este mes</small>
        </span>
      </div>
      <div className="lp-screen" aria-hidden>
        <div className="lp-bar">
          <h2>Agenda</h2>
          <span className="lp-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0Z" /></svg>
          </span>
        </div>
        <div className="lp-banner">
          <p>Hoy · Viernes 6</p>
          <p className="lp-big">$ 128.000 previstos</p>
          <p>5 citas en Estudio Lumen</p>
          <span className="lp-banner-btn">Ver la agenda</span>
        </div>
        <p className="lp-label">Próximas <span>Ver todas</span></p>
        {[
          ["10:00", "Laura Gómez", "Corte y peinado · Ana", "Reservada", false],
          ["11:30", "Marta Ruiz", "Manicure · Sofía", "Atendida", true],
        ].map(([t, n, s, st, ok]) => (
          <div key={String(t)} className="lp-appt">
            <span className="lp-appt-time">{t}</span>
            <span className="min-w-0">
              <span className="lp-appt-name block truncate">{n}</span>
              <span className="lp-appt-info block truncate">{s}</span>
            </span>
            <span className={ok ? "lp-status lp-status-ok" : "lp-status"}>{st}</span>
          </div>
        ))}
        <div className="lp-tabs">
          <span className="lp-on">Agenda</span>
          <span>Clientes</span>
          <span>Métricas</span>
          <span>Equipo</span>
        </div>
      </div>
    </div>
  );
}
