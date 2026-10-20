CREATE TABLE `sim_access_code` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`rotates_at` integer NOT NULL,
	`rotated_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`rotated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
