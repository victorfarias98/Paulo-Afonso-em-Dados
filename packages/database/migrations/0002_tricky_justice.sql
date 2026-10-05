ALTER TABLE "commitments" ADD COLUMN "reinforced_value" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "commitments" ADD COLUMN "budget_unit" text;--> statement-breakpoint
ALTER TABLE "commitments" ADD COLUMN "legal_basis" text;--> statement-breakpoint
ALTER TABLE "commitments" ADD COLUMN "bid_reference" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "retained_value" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "cancelled_value" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "budget_unit" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "expense_element" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "legal_basis" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD COLUMN "bid_reference" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "retained_value" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancelled_value" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "budget_unit" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expense_element" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "legal_basis" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bid_reference" text;--> statement-breakpoint
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;