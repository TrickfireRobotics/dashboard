CREATE TABLE `vendor_import` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`imported_by` text,
	`file_name` text NOT NULL,
	`file_hash` text NOT NULL,
	`total_count` integer NOT NULL,
	`approved_count` integer NOT NULL,
	`added_count` integer NOT NULL,
	`removed_count` integer NOT NULL,
	`changed_count` integer NOT NULL,
	FOREIGN KEY (`imported_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
