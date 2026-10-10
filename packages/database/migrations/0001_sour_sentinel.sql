ALTER TABLE "outbox" ADD COLUMN "tickets" jsonb;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "submitted_at" timestamp with time zone;