"use server";

import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayLong, formatTime, localDay } from "@/lib/time";

export async function getNotifications() {
  const { shop, barberId } = await requireShop();
  if (!barberId) return { unread: 0, items: [] };
  const where = { shopId: shop.id, barberId };
  const unread = await db.notification.count({ where: { ...where, readAt: null } });
  const notices = await db.notification.findMany({
    where, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { appointment: { include: { customer: true, service: true } } },
  });
  return { unread, items: notices.map((notice) => ({
    id: notice.id, type: notice.type, read: notice.readAt !== null,
    createdAt: notice.createdAt.toISOString(),
    customerName: notice.appointment.customer.name, serviceName: notice.appointment.service.name,
    appointmentDay: formatDayLong(notice.appointment.startsAt, shop.timezone),
    appointmentTime: formatTime(notice.appointment.startsAt, shop.timezone),
    day: localDay(notice.appointment.startsAt, shop.timezone),
  })) };
}

export async function markNotificationRead(id: string) {
  const { shop, barberId } = await requireShop();
  if (!barberId || typeof id !== "string") return;
  await db.notification.updateMany({
    where: { id, shopId: shop.id, barberId, readAt: null }, data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead() {
  const { shop, barberId } = await requireShop();
  if (!barberId) return;
  await db.notification.updateMany({
    where: { shopId: shop.id, barberId, readAt: null }, data: { readAt: new Date() },
  });
}
