CREATE TYPE "BusinessType" AS ENUM ('BARBERIA', 'PELUQUERIA', 'UNAS', 'ESTETICA', 'SPA', 'OTRO');

-- Los negocios existentes son barberías.
ALTER TABLE "Shop" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'BARBERIA';

-- Los nuevos negocios usan el valor predeterminado del esquema.
ALTER TABLE "Shop" ALTER COLUMN "businessType" SET DEFAULT 'OTRO';
