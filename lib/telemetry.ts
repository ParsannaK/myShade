export const TELEMETRY_EVENT_NAMES = [
  "site_entered",
  "letter_opened",
  "letter_narration_played",
  "memory_opened",
  "firefly_clicked",
  "memory_walk_completed",
  "wish_sent",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];
