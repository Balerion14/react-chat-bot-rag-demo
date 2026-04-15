CREATE TABLE "chat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"user_message" text NOT NULL,
	"detected_intent" text,
	"filter" boolean DEFAULT false NOT NULL,
	"need_to_retrieve_context" boolean DEFAULT false NOT NULL,
	"retrieved_context" jsonb,
	"first_response" jsonb,
	"guardrail_status" text,
	"final_reply" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_language" text DEFAULT 'en' NOT NULL,
	"check_in_date" date,
	"check_out_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_runs_reservation_id" ON "chat_runs" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_chat_runs_created_at" ON "chat_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_knowledge_items_property_id" ON "knowledge_items" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_items_category" ON "knowledge_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_reservations_property_id" ON "reservations" USING btree ("property_id");