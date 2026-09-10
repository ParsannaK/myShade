CREATE TABLE `telemetry_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_name` text NOT NULL,
	`session_id` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telemetry_session_event_detail` ON `telemetry_events` (`session_id`,`event_name`,`detail`);--> statement-breakpoint
CREATE INDEX `idx_telemetry_event_created_at` ON `telemetry_events` (`event_name`,`created_at`);