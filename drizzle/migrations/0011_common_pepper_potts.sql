CREATE TABLE `sim_export_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`element_id` text NOT NULL,
	`archive_path` text NOT NULL,
	`archive_size_bytes` integer DEFAULT 0 NOT NULL,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_accessed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`access_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sim_export_cache_key` ON `sim_export_cache` (`document_id`,`workspace_id`,`element_id`);--> statement-breakpoint
CREATE INDEX `sim_export_cache_accessed` ON `sim_export_cache` (`last_accessed_at`);