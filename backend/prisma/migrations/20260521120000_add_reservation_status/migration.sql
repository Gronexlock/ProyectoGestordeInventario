-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'SOLD', 'EXPIRED');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "movements" ADD COLUMN     "reservationId" INTEGER;
