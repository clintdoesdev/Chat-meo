-- CreateEnum
CREATE TYPE "WidgetPosition" AS ENUM ('BOTTOM_LEFT', 'BOTTOM_RIGHT');

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcomeMessage" TEXT,
ADD COLUMN     "widgetPosition" "WidgetPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT';
