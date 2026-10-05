CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_dataset_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"is_full_scan" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_found" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_unchanged" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"records_missing" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"fetch_method" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_run_id" uuid,
	"source_updated_at" timestamp with time zone,
	"import_status" text DEFAULT 'pending' NOT NULL,
	"import_error" text
);
--> statement-breakpoint
CREATE TABLE "record_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"transformations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"schedule_cron" text DEFAULT '0 5 * * *' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"agency_name" text NOT NULL,
	"source_type" text NOT NULL,
	"base_url" text NOT NULL,
	"is_official" boolean DEFAULT true NOT NULL,
	"is_documented" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"acronym" text,
	"branch" text NOT NULL,
	"kind" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number" text NOT NULL,
	"modality" text,
	"process_number" text,
	"description" text,
	"estimated_value" numeric(16, 2),
	"published_at" date,
	"opening_date" date,
	"status" text DEFAULT 'informacao_insuficiente' NOT NULL,
	"agency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fiscal_year" integer NOT NULL,
	"number" text NOT NULL,
	"commitment_date" date,
	"agency_id" uuid,
	"supplier_id" uuid,
	"contract_id" uuid,
	"budget_function" text,
	"expense_element" text,
	"description" text,
	"committed_value" numeric(16, 2),
	"cancelled_value" numeric(16, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_agencies" (
	"contract_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amendment_number" text,
	"amendment_type" text,
	"description" text,
	"value_change" numeric(16, 2),
	"new_ends_at" date,
	"signed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number" text NOT NULL,
	"kind" text DEFAULT 'contrato' NOT NULL,
	"contract_type" text,
	"modality" text,
	"process_number" text,
	"bid_number" text,
	"description" text,
	"supplier_id" uuid,
	"agency_id" uuid,
	"bid_id" uuid,
	"original_value" numeric(16, 2),
	"current_value" numeric(16, 2),
	"signed_at" date,
	"starts_at" date,
	"ends_at" date,
	"fiscal_year" integer,
	"status" text DEFAULT 'informacao_insuficiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocodings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_work_address_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"precision" text NOT NULL,
	"provider" text NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"commitment_id" uuid,
	"fiscal_year" integer NOT NULL,
	"number" text,
	"liquidation_date" date,
	"value" numeric(16, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"commitment_id" uuid,
	"supplier_id" uuid,
	"contract_id" uuid,
	"agency_id" uuid,
	"fiscal_year" integer NOT NULL,
	"number" text,
	"payment_date" date,
	"value" numeric(16, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_work_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_work_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"address_type" text,
	"street" text,
	"number" text,
	"complement" text,
	"neighborhood" text,
	"city" text
);
--> statement-breakpoint
CREATE TABLE "public_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"source_status" text,
	"source_missing_since" date,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"description" text,
	"work_type" text,
	"contract_id" uuid,
	"bid_id" uuid,
	"agency_id" uuid,
	"initial_value" numeric(16, 2),
	"current_value" numeric(16, 2),
	"start_date" date,
	"deadline_days" integer,
	"expected_end_date" date,
	"is_expected_end_date_derived" boolean DEFAULT false NOT NULL,
	"actual_end_date" date,
	"progress_percentage" double precision,
	"status" text DEFAULT 'informacao_insuficiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text,
	"is_document_masked" boolean DEFAULT false NOT NULL,
	"legal_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"trade_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_type" text NOT NULL,
	"from_id" uuid NOT NULL,
	"to_type" text NOT NULL,
	"to_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"method" text NOT NULL,
	"confidence" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manual_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"original_value" jsonb,
	"corrected_value" jsonb,
	"justification" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_dataset_id_source_datasets_id_fk" FOREIGN KEY ("source_dataset_id") REFERENCES "public"."source_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_first_run_id_ingestion_runs_id_fk" FOREIGN KEY ("first_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_provenance" ADD CONSTRAINT "record_provenance_raw_record_id_raw_records_id_fk" FOREIGN KEY ("raw_record_id") REFERENCES "public"."raw_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_datasets" ADD CONSTRAINT "source_datasets_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_parent_id_agencies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_aliases" ADD CONSTRAINT "agency_aliases_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_aliases" ADD CONSTRAINT "agency_aliases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_agencies" ADD CONSTRAINT "contract_agencies_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_agencies" ADD CONSTRAINT "contract_agencies_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_budget_lines" ADD CONSTRAINT "contract_budget_lines_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geocodings" ADD CONSTRAINT "geocodings_public_work_address_id_public_work_addresses_id_fk" FOREIGN KEY ("public_work_address_id") REFERENCES "public"."public_work_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_commitment_id_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_work_addresses" ADD CONSTRAINT "public_work_addresses_public_work_id_public_works_id_fk" FOREIGN KEY ("public_work_id") REFERENCES "public"."public_works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_dataset_started_idx" ON "ingestion_runs" USING btree ("source_dataset_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_records_version_uq" ON "raw_records" USING btree ("source_id","entity_type","external_id","payload_hash");--> statement-breakpoint
CREATE INDEX "raw_records_lookup_idx" ON "raw_records" USING btree ("source_id","entity_type","external_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "raw_records_status_idx" ON "raw_records" USING btree ("import_status");--> statement-breakpoint
CREATE UNIQUE INDEX "record_provenance_uq" ON "record_provenance" USING btree ("entity_type","entity_id","raw_record_id");--> statement-breakpoint
CREATE INDEX "record_provenance_entity_idx" ON "record_provenance" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_datasets_source_entity_uq" ON "source_datasets" USING btree ("source_id","entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_aliases_source_name_uq" ON "agency_aliases" USING btree ("source_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_source_external_uq" ON "bids" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "bids_number_idx" ON "bids" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "commitments_source_external_uq" ON "commitments" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "commitments_year_agency_idx" ON "commitments" USING btree ("fiscal_year","agency_id");--> statement-breakpoint
CREATE INDEX "commitments_supplier_idx" ON "commitments" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_agencies_uq" ON "contract_agencies" USING btree ("contract_id","agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_amendments_source_external_uq" ON "contract_amendments" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "contract_amendments_contract_idx" ON "contract_amendments" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_budget_lines_uq" ON "contract_budget_lines" USING btree ("contract_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_source_external_uq" ON "contracts" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "contracts_supplier_idx" ON "contracts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "contracts_agency_idx" ON "contracts" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "contracts_signed_idx" ON "contracts" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "contracts_number_idx" ON "contracts" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_uq" ON "documents" USING btree ("entity_type","entity_id","source_url");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "liquidations_source_external_uq" ON "liquidations" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "liquidations_commitment_idx" ON "liquidations" USING btree ("commitment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_source_external_uq" ON "payments" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_supplier_idx" ON "payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "payments_contract_idx" ON "payments" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_work_addresses_uq" ON "public_work_addresses" USING btree ("public_work_id","position");--> statement-breakpoint
CREATE INDEX "public_work_addresses_neighborhood_idx" ON "public_work_addresses" USING btree ("neighborhood");--> statement-breakpoint
CREATE UNIQUE INDEX "public_works_source_external_uq" ON "public_works" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "public_works_contract_idx" ON "public_works" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "public_works_status_idx" ON "public_works" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cnpj_uq" ON "suppliers" USING btree ("document_number") WHERE "suppliers"."document_type" = 'cnpj' and "suppliers"."is_document_masked" = false;--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_links_uq" ON "entity_links" USING btree ("from_type","from_id","to_type","to_id","relation","method");--> statement-breakpoint
CREATE INDEX "entity_links_from_idx" ON "entity_links" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "entity_links_to_idx" ON "entity_links" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "manual_overrides_entity_idx" ON "manual_overrides" USING btree ("entity_type","entity_id");