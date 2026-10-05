CREATE TABLE "collection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "login" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_requested_by_admin_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_requests_status_idx" ON "collection_requests" USING btree ("status","requested_at");--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_login_unique" UNIQUE("login");