CREATE TABLE `github_notion_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`notion_database_id` text NOT NULL,
	`notion_database_name` text,
	`github_owner` text NOT NULL,
	`github_repo` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_synced_at` integer,
	`last_sync_error` text,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_notion_link_team_unique` ON `github_notion_link` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `github_notion_link_notion_db_unique` ON `github_notion_link` (`notion_database_id`);--> statement-breakpoint
CREATE TABLE `github_notion_task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`notion_page_id` text NOT NULL,
	`notion_task_key` text NOT NULL,
	`github_issue_number` integer NOT NULL,
	`last_notion_edited_time` text NOT NULL,
	`last_github_updated_at` text NOT NULL,
	`last_synced_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `github_notion_link`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_notion_task_link_page_unique` ON `github_notion_task` (`link_id`,`notion_page_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `github_notion_task_link_issue_unique` ON `github_notion_task` (`link_id`,`github_issue_number`);