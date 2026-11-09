-- Índices para claves foráneas (borrados en cascada y consultas por relación)
-- y para la limpieza periódica de tablas que crecen solas.
CREATE INDEX "Membership_shopId_idx" ON "Membership"("shopId");
CREATE INDEX "ShopPhoto_barberId_idx" ON "ShopPhoto"("barberId");
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Notification_appointmentId_idx" ON "Notification"("appointmentId");
CREATE INDEX "Notification_shopId_idx" ON "Notification"("shopId");
CREATE INDEX "RateLimitHit_createdAt_idx" ON "RateLimitHit"("createdAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
