-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parents" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
