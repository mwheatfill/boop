ALTER TABLE `targets` ADD `internal_origin` text;--> statement-breakpoint
ALTER TABLE `tunnels` DROP COLUMN `internal_origin`;