-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('training', 'game', 'event');

-- CreateEnum
CREATE TYPE "NotificationTargetMode" AS ENUM ('all', 'selected');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetMode" "NotificationTargetMode" NOT NULL,
    "childIds" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryAttempted" INTEGER NOT NULL DEFAULT 0,
    "deliveryDelivered" INTEGER NOT NULL DEFAULT 0,
    "deliveryFailed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_sectionId_createdAt_idx" ON "Notification"("sectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_notificationId_userId_key" ON "NotificationRead"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "NotificationRead_userId_readAt_idx" ON "NotificationRead"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
