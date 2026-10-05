ALTER TABLE "commitments" ADD COLUMN "commitment_description" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "commitment_number" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "commitment_description" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "commitment_number" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "commitment_description" text;