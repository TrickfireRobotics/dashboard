CREATE TABLE `stf_quarter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stf_quarter_name_unique` ON `stf_quarter` (`name`);
--> statement-breakpoint
CREATE TABLE `stf_bucket` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quarter_id` integer NOT NULL,
	`name` text NOT NULL,
	`starting_balance_cents` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`quarter_id`) REFERENCES `stf_quarter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gift_fund` (
	`id` integer PRIMARY KEY NOT NULL,
	`current_value_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gift_fund_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`changed_by` text,
	`change_type` text NOT NULL,
	`previous_value_cents` integer NOT NULL,
	`new_value_cents` integer NOT NULL,
	`order_id` integer,
	`note` text,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `orders_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`fund_type` text NOT NULL,
	`stf_bucket_id` integer,
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
	FOREIGN KEY (`quarter_id`) REFERENCES `stf_quarter`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `orders_new` (
	`id`,
	`user_id`,
	`fund_type`,
	`vendor`,
	`link`,
	`item_name`,
	`part_number`,
	`quantity`,
	`unit_cost_cents`,
	`notes`,
	`status`,
	`denial_comment`,
	`reviewed_by`,
	`reviewed_at`,
	`created_at`
)
SELECT
	`id`,
	`user_id`,
	'STF',
	coalesce(nullif(trim(`part_type`), ''), 'Unknown'),
	coalesce(nullif(trim(`vendor_url`), ''), 'https://example.com'),
	`item_name`,
	`part_number`,
	`quantity`,
	coalesce(`unit_price`, 0),
	`description`,
	CASE
		WHEN `status` = 'rejected' THEN 'denied'
		WHEN `status` = 'ordered' THEN 'approved'
		ELSE `status`
	END,
	`admin_note`,
	`reviewed_by`,
	`reviewed_at`,
	`created_at`
FROM `orders`;
--> statement-breakpoint
DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders_new` RENAME TO `orders`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
INSERT INTO `gift_fund` (`id`, `current_value_cents`) VALUES (1, 0);
