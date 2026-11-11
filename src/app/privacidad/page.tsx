import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Cómo trata AppTuServicio los datos personales de negocios, profesionales y clientes.",
};

// BORRADOR pendiente de revisión legal. Los datos entre corchetes los debe
// completar el titular antes de publicar (ver docs/REQUISITOS.md, RNF-14).
const OWNER = {
  name: "[Nombre o razón social del titular de AppTuServicio]",
  id: "[Cédula o NIT]",
  city: "[Ciudad], Colombia",
  email: "[correo de contacto para datos personales]",
};
const UPDATED = "7 de noviembre de 2026";

export default function PrivacyPage() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <Link href="/" className="press inline-block text-[22px] font-bold tracking-[-0.02em] mb-8">
        AppTu<span className="font-medium text-muted">Servicio</span>
      </Link>
      <article className="brand-card p-6 sm:p-10 grid gap-6 text-[16px] leading-relaxed [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:grid [&_ul]:gap-1.5 [&_p]:text-ink/90">
        <header>
          <h1 className="brand-display brand-display-lg">Aviso de privacidad</h1>
          <p className="text-muted mt-2">Última actualización: {UPDATED}</p>
        </header>

        <p>
          Este aviso explica cómo se tratan los datos personales en AppTuServicio, la plataforma de agenda y reservas
          online para negocios con citas, conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas de
          protección de datos de Colombia.
        </p>

        <section className="grid gap-3">
          <h2>1. Quién trata tus datos</h2>
          <p>
            <strong>Datos de clientes que reservan:</strong> el responsable es el negocio donde reservas (por ejemplo,
            la barbería o el salón cuyo nombre aparece en la página de reservas). AppTuServicio actúa como encargado:
            guarda y procesa esos datos por cuenta del negocio y solo para prestar el servicio de agenda.
          </p>
          <p>
            <strong>Datos de negocios y profesionales con cuenta:</strong> el responsable es {OWNER.name},
            identificado con {OWNER.id}, con domicilio en {OWNER.city}. Contacto: {OWNER.email}.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>2. Qué datos recogemos</h2>
          <ul>
            <li>Al reservar: nombre, número de WhatsApp, correo (opcional), comentarios que escribas, y el servicio, profesional, día y hora elegidos.</li>
            <li>Al crear una cuenta: nombre, correo, contraseña (guardada cifrada, nunca en texto plano), nombre y datos de contacto del negocio.</li>
            <li>Fotos que el negocio o sus profesionales suban (logo, portada, foto de perfil y galería).</li>
            <li>Datos técnicos mínimos para la seguridad, como la dirección IP al ingresar o reservar, que se conservan como máximo 24 horas.</li>
          </ul>
        </section>

        <section className="grid gap-3">
          <h2>3. Para qué los usamos</h2>
          <ul>
            <li>Registrar y gestionar tu cita, y enviarte la confirmación y el recordatorio por WhatsApp o correo.</li>
            <li>Avisar al profesional de las reservas nuevas y de las cancelaciones.</li>
            <li>Permitir al negocio ver su agenda, el historial de sus clientes y sus métricas.</li>
            <li>Proteger la plataforma frente a abusos (por ejemplo, limitar intentos de ingreso).</li>
          </ul>
          <p>No vendemos tus datos ni los usamos para publicidad.</p>
        </section>

        <section className="grid gap-3">
          <h2>4. Con quién se comparten</h2>
          <p>
            Solo con el negocio donde reservas y con los proveedores que necesitamos para funcionar, que tratan los datos
            por nuestra cuenta: alojamiento de la aplicación y de las fotos (Vercel), base de datos (Neon), correo
            (Resend) y WhatsApp (Meta). Algunos de estos servicios guardan la información fuera de Colombia, en países
            con niveles adecuados de protección o con garantías contractuales. Al aceptar este aviso autorizas esa
            transferencia.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>5. Tus derechos</h2>
          <p>Como titular de los datos puedes:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Pedir prueba de la autorización que diste.</li>
            <li>Saber cómo se han usado tus datos.</li>
            <li>Revocar la autorización o pedir que se borren, cuando no exista un deber legal de conservarlos.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
          </ul>
          <p>
            Si eres cliente de un negocio, puedes dirigirte a él directamente o escribirnos a {OWNER.email} y
            trasladaremos tu solicitud. Respondemos las consultas en un máximo de 10 días hábiles y los reclamos en un
            máximo de 15 días hábiles.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>6. Cuánto tiempo los guardamos</h2>
          <p>
            Mientras el negocio use AppTuServicio y sea necesario para las finalidades anteriores. Si un negocio cierra
            su cuenta, sus datos y los de sus clientes se borran en un plazo razonable, salvo lo que la ley obligue a
            conservar.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>7. Seguridad</h2>
          <p>
            Usamos conexiones cifradas, contraseñas cifradas, accesos separados por negocio y por profesional, y límites
            de intentos. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te lo
            comunicaremos y lo reportaremos a la autoridad cuando corresponda.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>8. Menores de edad</h2>
          <p>
            Las reservas para menores deben hacerlas sus padres o representantes legales, que autorizan el tratamiento
            en su nombre.
          </p>
        </section>

        <section className="grid gap-3">
          <h2>9. Cambios en este aviso</h2>
          <p>
            Si cambiamos este aviso publicaremos la nueva versión en esta página con su fecha de actualización. Si el
            cambio es importante, lo avisaremos a los negocios con cuenta.
          </p>
        </section>
      </article>
    </main>
  );
}
