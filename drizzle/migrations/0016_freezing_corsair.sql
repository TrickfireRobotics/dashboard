CREATE TABLE `approved_vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_name` text NOT NULL,
	`search_name` text DEFAULT '' NOT NULL,
	`supplier_id` text,
	`status` text DEFAULT 'Unknown' NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`category` text,
	`group` text,
	`unique_entity_identifier` text,
	`email` text,
	`contact` text,
	`remit_address` text,
	`use_for` text,
	`imported_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approved_vendors_name_key` ON `approved_vendors` (`supplier_name`);--> statement-breakpoint
CREATE INDEX `approved_vendors_search_name_idx` ON `approved_vendors` (`search_name`);--> statement-breakpoint
CREATE INDEX `approved_vendors_approved_idx` ON `approved_vendors` (`approved`);--> statement-breakpoint
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
