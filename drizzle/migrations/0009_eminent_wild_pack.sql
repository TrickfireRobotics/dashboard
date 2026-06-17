CREATE TABLE `finance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`tax_percent_bps` integer DEFAULT 1100 NOT NULL,
	`shipping_percent_bps` integer DEFAULT 2000 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
