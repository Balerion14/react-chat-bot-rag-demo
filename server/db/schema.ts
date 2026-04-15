import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const propertiesTable = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reservationsTable = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    guestName: text("guest_name").notNull(),
    guestLanguage: text("guest_language").notNull().default("en"),
    checkInDate: date("check_in_date"),
    checkOutDate: date("check_out_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_reservations_property_id").on(table.propertyId)]
);

export const knowledgeItemsTable = pgTable(
  "knowledge_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_knowledge_items_property_id").on(table.propertyId),
    index("idx_knowledge_items_category").on(table.category),
  ]
);

export const chatRunsTable = pgTable(
  "chat_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id").references(() => reservationsTable.id, {
      onDelete: "cascade",
    }),
    userMessage: text("user_message").notNull(),
    detectedIntent: text("detected_intent"),
    filter: boolean("filter").notNull().default(false),
    needToRetrieveContext: boolean("need_to_retrieve_context").notNull().default(false),
    retrievedContext: jsonb("retrieved_context"),
    firstResponse: jsonb("first_response"),
    guardrailStatus: text("guardrail_status"),
    finalReply: jsonb("final_reply"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_chat_runs_reservation_id").on(table.reservationId),
    index("idx_chat_runs_created_at").on(table.createdAt),
  ]
);

export type Property = typeof propertiesTable.$inferSelect;
export type Reservation = typeof reservationsTable.$inferSelect;
export type KnowledgeItem = typeof knowledgeItemsTable.$inferSelect;
export type ChatRun = typeof chatRunsTable.$inferSelect;
