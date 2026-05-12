ALTER TABLE `attempts` ADD `request_headers_json` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `trigger_source` text DEFAULT 'cron' NOT NULL;