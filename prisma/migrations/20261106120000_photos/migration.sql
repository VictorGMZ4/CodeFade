-- Imágenes públicas del negocio y de sus profesionales.
ALTER TABLE "Shop" ADD COLUMN "logoUrl" TEXT, ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "Barber" ADD COLUMN "photoUrl" TEXT;

-- La galería conserva sus fotos aunque se elimine el profesional que las subió.
CREATE TABLE "ShopPhoto" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "barberId" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShopPhoto_shopId_createdAt_idx" ON "ShopPhoto"("shopId", "createdAt");
ALTER TABLE "ShopPhoto" ADD CONSTRAINT "ShopPhoto_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopPhoto" ADD CONSTRAINT "ShopPhoto_barberId_fkey"
    FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
