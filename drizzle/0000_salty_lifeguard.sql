CREATE TABLE `health_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checked_at` integer NOT NULL,
	`status` text NOT NULL,
	`detail` text
);
