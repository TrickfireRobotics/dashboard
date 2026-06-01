CREATE TABLE `user_feature` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`feature_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`request_note` text,
	`admin_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`requested_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_feature_unique` ON `user_feature` (`user_id`,`feature_key`);--> statement-breakpoint
CREATE INDEX `user_feature_userId_idx` ON `user_feature` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `approved` integer DEFAULT false;
--> statement-breakpoint
UPDATE `user` SET `approved` = 1;
--> statement-breakpoint
INSERT INTO `user_feature` (`user_id`, `feature_key`, `status`, `requested_at`)
SELECT `id`, 'orders', 'granted', (cast(unixepoch('subsecond') * 1000 as integer)) FROM `user`;
--> statement-breakpoint
INSERT INTO `user_feature` (`user_id`, `feature_key`, `status`, `requested_at`)
SELECT `id`, 'api-keys', 'granted', (cast(unixepoch('subsecond') * 1000 as integer)) FROM `user`;
--> statement-breakpoint
INSERT INTO `user_feature` (`user_id`, `feature_key`, `status`, `requested_at`)
SELECT `id`, 'minecraft', 'granted', (cast(unixepoch('subsecond') * 1000 as integer)) FROM `user`;
--> statement-breakpoint
INSERT INTO `user_feature` (`user_id`, `feature_key`, `status`, `requested_at`)
SELECT `id`, 'headscale', 'granted', (cast(unixepoch('subsecond') * 1000 as integer)) FROM `user`;