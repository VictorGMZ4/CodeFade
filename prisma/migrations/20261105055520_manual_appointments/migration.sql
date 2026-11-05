-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'MANUAL');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MANUAL_BY_OWNER';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
