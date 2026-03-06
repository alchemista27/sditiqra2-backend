/*
  Warnings:

  - The values [PENDING,VERIFYING] on the enum `RegistrationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `address` on the `parents` table. All the data in the column will be lost.
  - You are about to drop the column `nik` on the `parents` table. All the data in the column will be lost.
  - You are about to drop the column `docIjazahTK` on the `registrations` table. All the data in the column will be lost.
  - You are about to drop the column `photo` on the `registrations` table. All the data in the column will be lost.
  - You are about to drop the column `previousSchool` on the `registrations` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `registrations` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RegistrationStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'FORM_SUBMITTED', 'ADMIN_REVIEW', 'ADMIN_PASSED', 'CLINIC_LETTER_UPLOADED', 'OBSERVATION_SCHEDULED', 'OBSERVATION_DONE', 'ACCEPTED', 'REJECTED');
ALTER TABLE "public"."registrations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "registrations" ALTER COLUMN "status" TYPE "RegistrationStatus_new" USING ("status"::text::"RegistrationStatus_new");
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
ALTER TYPE "RegistrationStatus_new" RENAME TO "RegistrationStatus";
DROP TYPE "public"."RegistrationStatus_old";
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- DropIndex
DROP INDEX "parents_nik_key";

-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN     "registrationFee" INTEGER NOT NULL DEFAULT 300000;

-- AlterTable
ALTER TABLE "parents" DROP COLUMN "address",
DROP COLUMN "nik",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "registrations" DROP COLUMN "docIjazahTK",
DROP COLUMN "photo",
DROP COLUMN "previousSchool",
DROP COLUMN "verifiedAt",
ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "adminReviewedAt" TIMESTAMP(3),
ADD COLUMN     "adminReviewedBy" TEXT,
ADD COLUMN     "aspiration" TEXT,
ADD COLUMN     "classroomId" TEXT,
ADD COLUMN     "clinicCertUploadedAt" TIMESTAMP(3),
ADD COLUMN     "clinicReferralNo" TEXT,
ADD COLUMN     "clinicReferralUrl" TEXT,
ADD COLUMN     "docClinicCert" TEXT,
ADD COLUMN     "docKtpFather" TEXT,
ADD COLUMN     "docKtpMother" TEXT,
ADD COLUMN     "docPhoto" TEXT,
ADD COLUMN     "docTkCert" TEXT,
ADD COLUMN     "fatherAddress" TEXT,
ADD COLUMN     "fatherIncome" TEXT,
ADD COLUMN     "fatherJob" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "fatherNik" TEXT,
ADD COLUMN     "fatherPhone" TEXT,
ADD COLUMN     "formSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "guardianIncome" TEXT,
ADD COLUMN     "guardianJob" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianNik" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "hasSpecialNeeds" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hobby" TEXT,
ADD COLUMN     "motherAddress" TEXT,
ADD COLUMN     "motherIncome" TEXT,
ADD COLUMN     "motherJob" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "motherNik" TEXT,
ADD COLUMN     "motherPhone" TEXT,
ADD COLUMN     "nickName" TEXT,
ADD COLUMN     "nisn" TEXT,
ADD COLUMN     "observationNote" TEXT,
ADD COLUMN     "observationResult" TEXT,
ADD COLUMN     "observationSlotId" TEXT,
ADD COLUMN     "observedAt" TIMESTAMP(3),
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentProof" TEXT,
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedBy" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "siblingCount" INTEGER,
ADD COLUMN     "specialNeedsDesc" TEXT,
ADD COLUMN     "transport" TEXT,
ALTER COLUMN "studentName" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "birthPlace" DROP NOT NULL,
ALTER COLUMN "birthDate" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- CreateTable
CREATE TABLE "observation_slots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "quota" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 1,
    "maxStudents" INTEGER NOT NULL DEFAULT 30,
    "homeroomTeacher" TEXT,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_observationSlotId_fkey" FOREIGN KEY ("observationSlotId") REFERENCES "observation_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_slots" ADD CONSTRAINT "observation_slots_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
