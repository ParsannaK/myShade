import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const telemetryEvents = sqliteTable(
  "telemetry_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventName: text("event_name").notNull(),
    sessionId: text("session_id").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("idx_telemetry_session_event_detail").on(
      table.sessionId,
      table.eventName,
      table.detail,
    ),
    index("idx_telemetry_event_created_at").on(
      table.eventName,
      table.createdAt,
    ),
  ],
);
