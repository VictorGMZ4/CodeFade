# AppTuServicio · Agenda online para negocios con citas

SaaS de reservas para negocios. Cada negocio se registra, configura servicios, profesionales y horarios, y comparte un enlace público (`/b/<su-enlace>`) donde los clientes reservan desde el móvil. Los recordatorios salen por WhatsApp y correo.

El registro exige elegir el tipo de negocio y el dueño puede cambiarlo en Ajustes. Este dato no modifica las reservas. La migración `20261105200000_business_type` asigna `BARBERIA` a los negocios existentes y deja `OTRO` como valor predeterminado para nuevas filas.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind 4 · Prisma 7 · PostgreSQL.

## Puesta en marcha

```bash
npm install
npm run db:start      # Postgres local sin Docker (prisma dev / PGlite)
npm run db:migrate    # aplica migraciones y genera el cliente
npm run db:seed       # negocio de ejemplo
npm run dev
```

- Reserva de ejemplo: http://localhost:3000/b/demo
- Panel del dueño (Andrés): http://localhost:3000/ingresar → `demo@codefade.test` / `demo1234`
- Panel del profesional (Camilo): http://localhost:3000/ingresar → `camilo@codefade.test` / `demo1234`

El dueño administra todo el negocio y los accesos; el profesional solo ve sus citas y gestiona su horario y ausencias.

Copia `.env.example` a `.env` y genera `SESSION_SECRET` y `CRON_SECRET` (`openssl rand -base64 32`).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `/registro`, `/ingresar` | Alta de negocio y acceso |
| `/panel` | Agenda del día por profesional, con acciones (atendida, no vino, cancelar, WhatsApp) |
| `/panel/servicios` | Servicios con duración y precio |
| `/panel/equipo` | Profesionales, horario semanal con pausas y ausencias |
| `/panel/ajustes` | Enlace público, turnos cada X min, antelación, ventana de reserva, recordatorio |
| `/b/[slug]` | Reserva pública: servicio → profesional → día y hora → datos |
| `/cita/[token]` | Confirmación; el cliente puede ver o cancelar su cita |
| `/api/cron/reminders` | Envía los recordatorios pendientes |

Lógica principal en `src/lib/`: `availability.ts` (cálculo de huecos), `booking.ts` (reserva), `notify.ts` (WhatsApp/correo), `auth.ts` (sesión y negocio actual).

## Decisiones importantes

- **Sin dobles reservas.** Además de validar en el servidor, Postgres tiene una restricción de exclusión (`Appointment_no_overlap`, con `btree_gist`) que impide dos citas activas solapadas del mismo profesional, incluso si dos clientes confirman a la vez.
- **Zonas horarias.** Todo se guarda en UTC; cada negocio tiene su zona (`Shop.timezone`) y los horarios de trabajo se guardan en minutos locales.
- **Multi-negocio.** Toda acción del panel obtiene el negocio desde la sesión (`requireShop`) y filtra por `shopId`; nunca se confía en un id que venga del formulario.
- **Precios** en la unidad mínima de la moneda (centavos). Se guarda una copia del precio en cada cita.

## Recordatorios

Programa una llamada cada 10-15 minutos (Vercel Cron, GitHub Actions, cron-job.org…):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/reminders
```

Sin claves configuradas, los mensajes se escriben en la consola del servidor.

- **Correo:** crea una cuenta en [Resend](https://resend.com), verifica tu dominio y define `RESEND_API_KEY` y `EMAIL_FROM`.
- **WhatsApp:** usa la WhatsApp Cloud API de Meta. Los mensajes iniciados por el negocio necesitan una plantilla aprobada; crea una llamada `recordatorio_cita` con 5 variables: nombre, negocio, día, hora y enlace. Define `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
- Desde la agenda, el profesional también puede escribir al cliente con un enlace `wa.me` desde su propio WhatsApp, sin configurar nada.

### Avisos al profesional

Las reservas públicas y las cancelaciones desde `/cita/[token]` guardan un aviso para el profesional asignado, incluso si todavía no tiene usuario. La campana muestra solo sus avisos, también para dueños vinculados, y se actualiza cada 30 segundos mientras la pestaña está visible. Los cambios desde la agenda no generan avisos.

Si el profesional tiene teléfono, WhatsApp se envía después de responder mediante `after()`. Un fallo al guardar o enviar el aviso se registra con `[avisos]` y no impide reservar ni cancelar. Sin credenciales se escribe el mensaje con `[aviso:whatsapp]`.

Crea en Meta dos plantillas aprobadas, ambas con idioma `WHATSAPP_TEMPLATE_LANG` (por defecto `es`):

| Variable | Plantilla por defecto | Texto sugerido |
| --- | --- | --- |
| `WHATSAPP_TEMPLATE_BARBER_NEW` | `aviso_reserva_barbero` | Hola {{1}}, tienes una nueva reserva de {{2}} para {{3}} el {{4}} a las {{5}}. |
| `WHATSAPP_TEMPLATE_BARBER_CANCEL` | `aviso_cancelacion_barbero` | Hola {{1}}, {{2}} canceló su cita de {{3}} del {{4}} a las {{5}}. |

Los parámetros son, en orden: nombre del profesional, cliente, servicio, día y hora en la zona del negocio. Se usan las mismas credenciales `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` de los recordatorios.

## Producción

Usa un Postgres gestionado (Neon, Supabase, Prisma Postgres…), quita `DATABASE_POOL_MAX` (en local vale 1 porque PGlite solo acepta una conexión) y despliega con:

```bash
npx prisma migrate deploy
npm run build
```
