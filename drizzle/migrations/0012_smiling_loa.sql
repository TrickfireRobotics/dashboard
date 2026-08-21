PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`fund_type` text,
	`stf_bucket_id` integer,
	`batch_id` text,
	`assigned_by` text,
	`assigned_at` integer,
	`quarter_id` integer,
	`vendor` text NOT NULL,
	`link` text NOT NULL,
	`item_name` text NOT NULL,
	`part_number` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`denial_comment` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stf_bucket_id`) REFERENCES `stf_bucket`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`quarter_id`) REFERENCES `stf_quarter`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "user_id", "fund_type", "stf_bucket_id", "batch_id", "assigned_by", "assigned_at", "quarter_id", "vendor", "link", "item_name", "part_number", "quantity", "unit_cost_cents", "notes", "status", "denial_comment", "reviewed_by", "reviewed_at", "created_at") SELECT "id", "user_id", "fund_type", "stf_bucket_id", NULL, NULL, NULL, "quarter_id", "vendor", "link", "item_name", "part_number", "quantity", "unit_cost_cents", "notes", "status", "denial_comment", "reviewed_by", "reviewed_at", "created_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `orders_batch_id_idx` ON `orders` (`batch_id`);