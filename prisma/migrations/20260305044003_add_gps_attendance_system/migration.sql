-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL', 'SCHOOL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceType" ADD VALUE 'CUTI';
ALTER TYPE "AttendanceType" ADD VALUE 'DINAS';

-- AlterTable
ALTER TABLE "attendance_logs" ADD COLUMN     "anomalyFlag" TEXT,
ADD COLUMN     "anomalyNote" TEXT,
ADD COLUMN     "clockInDistance" DOUBLE PRECISION,
ADD COLUMN     "clockInLat" DOUBLE PRECISION,
ADD COLUMN     "clockInLng" DOUBLE PRECISION,
ADD COLUMN     "clockInSelfie" TEXT,
ADD COLUMN     "clockOutDistance" DOUBLE PRECISION,
ADD COLUMN     "clockOutLat" DOUBLE PRECISION,
ADD COLUMN     "clockOutLng" DOUBLE PRECISION,
ADD COLUMN     "clockOutSelfie" TEXT,
ADD COLUMN     "faceConfidence" DOUBLE PRECISION,
ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMockGps" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "faceEmbedding" TEXT;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT;

-- CreateTable
CREATE TABLE "attendance_configs" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL DEFAULT 'SDIT Iqra 2 Kota Bengkulu',
    "schoolLatitude" DOUBLE PRECISION NOT NULL DEFAULT -3.7928,
    "schoolLongitude" DOUBLE PRECISION NOT NULL DEFAULT 102.2608,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "clockInStart" TEXT NOT NULL DEFAULT '06:30',
    "clockInEnd" TEXT NOT NULL DEFAULT '08:00',
    "clockOutStart" TEXT NOT NULL DEFAULT '14:00',
    "clockOutEnd" TEXT NOT NULL DEFAULT '17:00',
    "lateThreshold" TEXT NOT NULL DEFAULT '07:15',
    "minFaceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "allowMockGps" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL DEFAULT 'NATIONAL',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_name_key" ON "holidays"("date", "name");
