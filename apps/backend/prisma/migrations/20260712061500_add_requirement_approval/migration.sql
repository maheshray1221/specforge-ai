ALTER TYPE "RequirementStatus" ADD VALUE 'APPROVED';

ALTER TABLE "Requirement"
  ADD COLUMN "clarificationAnswers" JSONB;
