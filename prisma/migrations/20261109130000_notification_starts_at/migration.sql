-- Cada aviso guarda la hora de la cita en el momento en que se creó: si la cita
-- se reprograma después, los avisos anteriores siguen mostrando su hora.
ALTER TABLE "Notification" ADD COLUMN "startsAt" TIMESTAMP(3);
