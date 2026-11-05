-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_shopId_customerId_idx" ON "Appointment"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "Appointment_shopId_barberId_customerId_idx" ON "Appointment"("shopId", "barberId", "customerId");
