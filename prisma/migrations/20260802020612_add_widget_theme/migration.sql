-- CreateEnum
CREATE TYPE "WidgetTheme" AS ENUM ('DEFAULT', 'WHATSAPP', 'TELEGRAM');

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "theme" "WidgetTheme" NOT NULL DEFAULT 'DEFAULT';
