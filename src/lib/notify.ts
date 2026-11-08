import "server-only";
import { formatDayLong, formatTime } from "@/lib/time";

// Canales de recordatorio. Si falta la clave de un proveedor, en desarrollo el
// mensaje se escribe en la consola para probar el flujo completo. En producción
// nunca: los registros no deben guardar enlaces de cita, de recuperación ni datos
// personales, y el envío cuenta como fallido.
const simulate = process.env.NODE_ENV !== "production";

function missing(channel: string) {
  console.warn(`[${channel}] Canal sin configurar en producción: no se envió el mensaje.`);
}

export type ReminderData = {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  shopName: string;
  shopAddress: string | null;
  serviceName: string;
  barberName: string;
  startsAt: Date;
  timezone: string;
  manageUrl: string;
};

type ChannelResult = { channel: "email" | "whatsapp"; ok: boolean; detail?: string };

export type BarberNoticeData = {
  type: "NEW_BOOKING" | "CLIENT_CANCELLED" | "MANUAL_BY_OWNER";
  barberName: string;
  barberPhone: string;
  customerName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
};

export async function sendBarberNotice(data: BarberNoticeData): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const day = formatDayLong(data.startsAt, data.timezone);
  const time = formatTime(data.startsAt, data.timezone);
  const isNew = data.type === "NEW_BOOKING" || data.type === "MANUAL_BY_OWNER";
  if (!token || !phoneId) {
    if (!simulate) return missing("aviso:whatsapp");
    console.info(`[aviso:whatsapp] ${data.barberPhone}: Hola ${data.barberName}, ${isNew ? "nueva reserva" : "cancelación del cliente"}: ${data.customerName}, ${data.serviceName}, ${day} a las ${time}.`);
    return;
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: data.barberPhone.replace("+", ""), type: "template",
      template: {
        name: isNew ? (process.env.WHATSAPP_TEMPLATE_BARBER_NEW ?? "aviso_reserva_barbero") : (process.env.WHATSAPP_TEMPLATE_BARBER_CANCEL ?? "aviso_cancelacion_barbero"),
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
        components: [{ type: "body", parameters: [data.barberName, data.customerName, data.serviceName, day, time].map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp rechazó el aviso (${res.status}): ${await res.text()}`);
}

export async function sendReminder(data: ReminderData): Promise<ChannelResult[]> {
  const results: ChannelResult[] = data.customerPhone ? [await sendWhatsApp({ ...data, customerPhone: data.customerPhone })] : [];
  if (data.customerEmail) results.push(await sendEmail(data));
  return results;
}

function describe(data: ReminderData) {
  const day = formatDayLong(data.startsAt, data.timezone);
  const time = formatTime(data.startsAt, data.timezone);
  return { day, time };
}

async function sendWhatsApp(data: ReminderData & { customerPhone: string }): Promise<ChannelResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { day, time } = describe(data);

  if (!token || !phoneId) {
    if (!simulate) {
      missing("recordatorio:whatsapp");
      return { channel: "whatsapp", ok: false, detail: "WhatsApp sin configurar" };
    }
    console.info(
      `[recordatorio:whatsapp] ${data.customerPhone}: Hola ${data.customerName}, te recordamos tu cita en ${data.shopName} el ${day} a las ${time}. Gestiónala aquí: ${data.manageUrl}`,
    );
    return { channel: "whatsapp", ok: true, detail: "consola" };
  }

  // Los mensajes iniciados por el negocio requieren una plantilla aprobada en Meta.
  // Parámetros esperados: {{1}} nombre, {{2}} barbería, {{3}} día, {{4}} hora, {{5}} enlace.
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: data.customerPhone.replace("+", ""),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE ?? "recordatorio_cita",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
          components: [
            {
              type: "body",
              parameters: [data.customerName, data.shopName, day, time, data.manageUrl].map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
    });
    return { channel: "whatsapp", ok: res.ok, detail: res.ok ? undefined : await res.text() };
  } catch (error) {
    return { channel: "whatsapp", ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function sendEmail(data: ReminderData): Promise<ChannelResult> {
  const key = process.env.RESEND_API_KEY;
  const { day, time } = describe(data);
  const subject = `Recordatorio: tu cita en ${data.shopName} el ${day} a las ${time}`;

  if (!key) {
    if (!simulate) {
      missing("recordatorio:email");
      return { channel: "email", ok: false, detail: "Correo sin configurar" };
    }
    console.info(`[recordatorio:email] ${data.customerEmail}: ${subject}`);
    return { channel: "email", ok: true, detail: "consola" };
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#18181b">
      <p>Hola ${escapeHtml(data.customerName)},</p>
      <p>Te recordamos tu cita en <strong>${escapeHtml(data.shopName)}</strong>:</p>
      <p style="font-size:18px;margin:16px 0"><strong>${day}, ${time}</strong><br>
      ${escapeHtml(data.serviceName)} con ${escapeHtml(data.barberName)}</p>
      ${data.shopAddress ? `<p>${escapeHtml(data.shopAddress)}</p>` : ""}
      <p><a href="${data.manageUrl}">Ver o cancelar la cita</a></p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: data.customerEmail,
        subject,
        html,
      }),
    });
    return { channel: "email", ok: res.ok, detail: res.ok ? undefined : await res.text() };
  } catch (error) {
    return { channel: "email", ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Enlace wa.me para que el barbero escriba al cliente desde su propio WhatsApp. */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export async function sendPasswordReset({ to, name, url }: { to: string; name: string; url: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!simulate) throw new Error("Correo sin configurar: no se pudo enviar la recuperación.");
    console.info(`[recuperación:email] ${to}: Hola ${name}, crea una contraseña nueva: ${url}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM, to, subject: "Crea una contraseña nueva · AppTuServicio",
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><p>Hola ${escapeHtml(name)},</p><p><a href="${escapeHtml(url)}">Crear una contraseña nueva</a></p><p>Este enlace caduca en una hora y solo se puede usar una vez. Si no lo solicitaste, ignora este correo.</p></div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend rechazó el correo de recuperación (${res.status}).`);
}
