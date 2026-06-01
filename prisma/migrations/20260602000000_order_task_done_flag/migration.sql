-- OrderTask: replace progressPct/startedAt with done boolean.
-- DB chưa có Order data thật nên drop cột an toàn.

-- AlterTable
ALTER TABLE "OrderTask" DROP COLUMN "progressPct";
ALTER TABLE "OrderTask" DROP COLUMN "startedAt";
ALTER TABLE "OrderTask" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
