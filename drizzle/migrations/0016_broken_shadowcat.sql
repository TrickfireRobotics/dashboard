ALTER TABLE `approved_vendors` ADD `search_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `approved_vendors_search_name_idx` ON `approved_vendors` (`search_name`);