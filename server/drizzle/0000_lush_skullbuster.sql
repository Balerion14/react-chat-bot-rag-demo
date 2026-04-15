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

--> statement-breakpoint
insert into properties (name, address)
values
  ('Ocean View Apartment', '12 Seaside Road, Brighton, UK'),
  ('Central London Studio', '48 Camden Street, London, UK')
on conflict do nothing;

insert into reservations (
  property_id,
  guest_name,
  guest_language,
  check_in_date,
  check_out_date
)
select
  p.id,
  x.guest_name,
  x.guest_language,
  x.check_in_date,
  x.check_out_date
from (
  values
    ('Ocean View Apartment', 'Alice Martin', 'en', date '2026-04-20', date '2026-04-24'),
    ('Ocean View Apartment', 'Jean Dupont', 'fr', date '2026-05-02', date '2026-05-06'),
    ('Central London Studio', 'Maria Garcia', 'es', date '2026-04-18', date '2026-04-21')
) as x(property_name, guest_name, guest_language, check_in_date, check_out_date)
join properties p on p.name = x.property_name;

insert into knowledge_items (
  property_id,
  category,
  title,
  content
)
select
  p.id,
  x.category,
  x.title,
  x.content
from (
  values
    (
      'Ocean View Apartment',
      'check_in',
      'Check-in instructions',
      'Check-in starts at 3 PM. The key is in the lockbox next to the blue gate.'
    ),
    (
      'Ocean View Apartment',
      'wifi',
      'Wi-Fi access',
      'Wi-Fi name: OceanViewGuest. Password: Welcome2026'
    ),
    (
      'Ocean View Apartment',
      'house_rules',
      'House rules',
      'No smoking. No parties. Quiet hours after 10 PM.'
    ),
    (
      'Central London Studio',
      'check_out',
      'Check-out instructions',
      'Check-out is at 11 AM. Please leave the keys on the kitchen table.'
    ),
    (
      'Central London Studio',
      'transport',
      'Nearby transport',
      'The nearest station is Camden Town, around 7 minutes on foot.'
    )
) as x(property_name, category, title, content)
join properties p on p.name = x.property_name;