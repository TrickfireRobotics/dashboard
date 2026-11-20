DROP TABLE `api_key`;--> statement-breakpoint
DROP TABLE `vault_entry_access`;--> statement-breakpoint
DELETE FROM `minecraft_whitelist` WHERE `status` <> 'approved';--> statement-breakpoint
UPDATE `minecraft_whitelist` SET `user_id` = `reviewed_by` WHERE `user_id` IS NULL AND `reviewed_by` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_minecraft_whitelist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`username` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_minecraft_whitelist`("id", "user_id", "username", "created_at") SELECT "id", "user_id", "username", "created_at" FROM `minecraft_whitelist`;--> statement-breakpoint
DROP TABLE `minecraft_whitelist`;--> statement-breakpoint
ALTER TABLE `__new_minecraft_whitelist` RENAME TO `minecraft_whitelist`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `vault_entry` DROP COLUMN `type`;
