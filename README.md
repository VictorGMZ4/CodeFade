# Turno · Agenda para barberías

SaaS de reservas para barberías. Cada barbería se registra, configura servicios, barberos y horarios, y comparte un enlace público (`/b/<su-enlace>`) donde los clientes reservan desde el móvil. Los recordatorios salen por WhatsApp y correo.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind 4 · Prisma 7 · PostgreSQL.

## Puesta en marcha

```bash
npm install
npm run db:start      # Postgres local sin Docker (prisma dev / PGlite)
npm run db:migrate    # aplica migraciones y genera el cliente
npm run db:seed       # barbería de ejemplo
npm run dev
```

- Reserva de ejemplo: http://localhost:3000/b/demo
- Panel: http://localhost:3000/ingresar → `demo@turno.test` / `demo1234`

Copia `.env.example` a `.env` y genera `SESSION_SECRET` y `CRON_SECRET` (`openssl rand -base64 32`).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `/registro`, `/ingresar` | Alta de barbería y acceso |
| `/panel` | Agenda del día por barbero, con acciones (atendida, no vino, cancelar, WhatsApp) |
| `/panel/servicios` | Servicios con duración y precio |
| `/panel/equipo` | Barberos, horario semanal con pausas y ausencias |
| `/panel/ajustes` | Enlace público, turnos cada X min, antelación, ventana de reserva, recordatorio |
| `/b/[slug]` | Reserva pública: servicio → barbero → día y hora → datos |
| `/cita/[token]` | Confirmación; el cliente puede ver o cancelar su cita |
| `/api/cron/reminders` | Envía los recordatorios pendientes |

Lógica principal en `src/lib/`: `availability.ts` (cálculo de huecos), `booking.ts` (reserva), `notify.ts` (WhatsApp/correo), `auth.ts` (sesión y barbería actual).

## Decisiones importantes

- **Sin dobles reservas.** Además de validar en el servidor, Postgres tiene una restricción de exclusión (`Appointment_no_overlap`, con `btree_gist`) que impide dos citas activas solapadas del mismo barbero, incluso si dos clientes confirman a la vez.
- **Zonas horarias.** Todo se guarda en UTC; cada barbería tiene su zona (`Shop.timezone`) y los horarios de trabajo se guardan en minutos locales.
- **Multi-barbería.** Toda acción del panel obtiene la barbería desde la sesión (`requireShop`) y filtra por `shopId`; nunca se confía en un id que venga del formulario.
- **Precios** en la unidad mínima de la moneda (centavos). Se guarda una copia del precio en cada cita.

## Recordatorios

Programa una llamada cada 10-15 minutos (Vercel Cron, GitHub Actions, cron-job.org…):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/reminders
```

Sin claves configuradas, los mensajes se escriben en la consola del servidor.

- **Correo:** crea una cuenta en [Resend](https://resend.com), verifica tu dominio y define `RESEND_API_KEY` y `EMAIL_FROM`.
- **WhatsApp:** usa la WhatsApp Cloud API de Meta. Los mensajes iniciados por el negocio necesitan una plantilla aprobada; crea una llamada `recordatorio_cita` con 5 variables: nombre, barbería, día, hora y enlace. Define `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
- Desde la agenda, el barbero también puede escribir al cliente con un enlace `wa.me` desde su propio WhatsApp, sin configurar nada.

## Producción

Usa un Postgres gestionado (Neon, Supabase, Prisma Postgres…), quita `DATABASE_POOL_MAX` (en local vale 1 porque PGlite solo acepta una conexión) y despliega con:

```bash
npx prisma migrate deploy
npm run build
```
