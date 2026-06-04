/*
  Warnings:

  - You are about to drop the `DispatchSchedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "DispatchSchedule";

-- CreateTable
CREATE TABLE "dispatch_schedules" (
    "scheduleId" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_schedules_pkey" PRIMARY KEY ("scheduleId")
);

-- AddForeignKey
ALTER TABLE "dispatch_schedules" ADD CONSTRAINT "dispatch_schedules_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
