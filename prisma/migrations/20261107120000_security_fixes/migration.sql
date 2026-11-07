-- Revocar sesiones al cambiar o recuperar la contraseña.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Correo de contacto por cita: una reserva pública ya no cambia los datos del cliente.
ALTER TABLE "Appointment" ADD COLUMN "contactEmail" TEXT;
