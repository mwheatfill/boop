ALTER TABLE `jobs` ADD `max_attempts` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `overall_deadline_ms` integer DEFAULT 60000 NOT NULL;