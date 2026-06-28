ALTER TABLE `targets` ADD `origin_host_header` text;--> statement-breakpoint
ALTER TABLE `targets` ADD `origin_server_name` text;--> statement-breakpoint
ALTER TABLE `targets` ADD `origin_no_tls_verify` integer DEFAULT false NOT NULL;