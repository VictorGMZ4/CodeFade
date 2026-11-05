-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "bookingWindowDays" SET DEFAULT 15;

-- Las reservas admiten como máximo 15 días hacia adelante.
UPDATE "Shop" SET "bookingWindowDays" = 15 WHERE "bookingWindowDays" > 15;
