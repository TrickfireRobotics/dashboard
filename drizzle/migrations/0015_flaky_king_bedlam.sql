CREATE TABLE `approved_vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_name` text NOT NULL,
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
CREATE INDEX `approved_vendors_approved_idx` ON `approved_vendors` (`approved`);