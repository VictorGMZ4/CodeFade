import Link from "next/link";
import { Archivo } from "next/font/google";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { BogotaClock } from "./_landing/clock";
import { Closing } from "./_landing/closing";
import { DemoBooking } from "./_landing/demo-booking";
import { Reveal } from "./_landing/reveal";
import { ServicesDemo } from "./_landing/services-demo";
import { Steps } from "./_landing/steps";
import { Switches } from "./_landing/switches";
import "./_landing/landing.css";

// Archivo: 900 para los titulares en bloque; 400–600 para el texto y la app.
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "900"], variable: "--font-lp" });

const FAQ = [
  ["¿Tengo que instalar algo?", "No. AppTuServicio funciona en el navegador del celular o del computador, para ti y para tus clientes."],
  ["¿Mis clientes necesitan una cuenta?", "No. Reservan con su nombre y su WhatsApp, y reciben un enlace para ver, cambiar o cancelar la cita."],
  ["¿Y si dos eligen la misma hora?", "Solo uno se la lleva. La hora se comprueba al confirmar y al otro cliente se le pide que elija otra."],
  ["¿Puedo tener varios profesionales?", "Sí. Cada uno tiene su horario y su agenda, y el cliente elige con quién o deja que le toque el primero libre."],
  ["¿El cliente puede cambiar la hora?", "Sí, desde el enlace de su cita, hasta dos veces y con la antelación que tú definas. Al profesional le llega el aviso."],
  ["¿Y la hora del almuerzo?", "Cada día admite varias franjas, por ejemplo de 9:00 a 13:00 y de 14:00 a 19:00. En la pausa no se puede reservar."],
  ["¿Cómo llega el recordatorio?", "Por WhatsApp y, si el cliente dejó su correo, también por email. Tú decides con cuántas horas de antelación."],
  ["¿En qué países funciona?", "En cualquiera. Al crear el negocio eliges el país, y la agenda usa su hora, su moneda y su prefijo telefónico."],
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
    <div className={`lp ${archivo.variable} flex-1`}>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Reveal />
      <Header />
      <main>
        <Hero />
        <section aria-labelledby="servicios" className="lp-band-light">
          <div className="lp-wrap lp-two">
            <div data-reveal>
              <h2 id="servicios" className="lp-display lp-display-md">Escribes y se reserva</h2>
              <p className="lp-lead">
                Escribe tus servicios con su duración y su precio. Tu página de reservas queda lista al instante, con tu
                nombre y tus horarios.
              </p>
            </div>
            <div className="lp-card-dark" data-reveal>
              <ServicesDemo />
            </div>
          </div>
        </section>
        <section aria-labelledby="como" className="lp-wrap lp-section">
          <h2 id="como" className="lp-display lp-display-md" data-reveal>Así funciona</h2>
          <Steps />
        </section>
        <section aria-labelledby="funciones" className="lp-band-dark">
          <div className="lp-wrap">
            <h2 id="funciones" className="lp-display lp-display-lg lp-volt-text" data-reveal>
              Tu agenda trabaja sola
            </h2>
            <p className="lp-lead lp-on-dark" data-reveal>Enciende cada función y mira qué cambia para tu negocio.</p>
          </div>
          <Switches />
        </section>
        <Faq />
        <section aria-labelledby="empieza" className="lp-wrap lp-section">
          <div className="lp-card-cta">
            <h2 id="empieza" className="lp-display lp-display-lg lp-volt-text" data-reveal>Empieza hoy</h2>
            <Closing />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="lp-header">
      <nav className="lp-wrap lp-nav" aria-label="Principal">
        <Link href="/" className="lp-wordmark">AppTuServicio</Link>
        <div className="lp-nav-links">
          <a href="#servicios">Servicios</a>
          <a href="#como">Así funciona</a>
          <a href="#preguntas">Preguntas</a>
        </div>
        <div className="lp-nav-end">
          <Link href="/ingresar" className="lp-nav-signin">Ingresar</Link>
          <Link href="/registro" className="lp-pill lp-pill-outline">Crear mi negocio</Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-copy">
        <h1 className="lp-display lp-display-xl">
          <span className="lp-mask"><span>Tus clientes</span></span>
          <span className="lp-mask"><span>reservan solos</span></span>
        </h1>
        <p className="lp-lead lp-rise">
          Agenda online para barberías, peluquerías, uñas, estética y spa. Tu cliente elige servicio, profesional y hora
          desde el celular, y a ti te llega ordenado.
        </p>
        <div className="lp-actions lp-rise">
          <Link href="/registro" className="lp-pill lp-pill-volt">Crear mi negocio gratis</Link>
          <Link href="/b/demo" className="lp-textlink">Ver una reserva de ejemplo</Link>
        </div>
      </div>
      <div className="lp-wrap">
        <div className="lp-hero-stage lp-rise">
          <div className="lp-hero-note">
            <p className="lp-display lp-display-sm">Pruébalo como tu cliente</p>
            <p>Elige servicio, profesional y hora. Nada se guarda: es la reserva de un negocio de ejemplo.</p>
          </div>
          <DemoBooking />
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="preguntas" className="lp-wrap lp-section lp-faq">
      <h2 id="preguntas" className="lp-display lp-display-md lp-faq-head" data-reveal>Preguntas frecuentes</h2>
      <div className="lp-faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q} name="faq" className="lp-tile" data-reveal>
            <summary>
              {q}
              <span className="lp-plus" aria-hidden />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-grid">
        <div>
          <p className="lp-footer-lead">Agenda online para barberías, peluquerías, uñas, estética y spa.</p>
          <p className="lp-small"><BogotaClock /></p>
        </div>
        <nav aria-label="Pie de página" className="lp-footer-links">
          <a href="#servicios">Servicios</a>
          <a href="#como">Así funciona</a>
          <a href="#preguntas">Preguntas</a>
          <Link href="/b/demo">Reserva de ejemplo</Link>
          <Link href="/ingresar">Ingresar</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
      </div>
      <p className="lp-wrap lp-footer-mark" aria-hidden>AppTuServicio</p>
      <p className="lp-wrap lp-small lp-footer-legal">© 2026 AppTuServicio</p>
    </footer>
  );
}
