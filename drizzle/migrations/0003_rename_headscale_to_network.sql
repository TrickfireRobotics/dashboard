ALTER TABLE `headscale_join_request` RENAME TO `network_join_request`;
--> statement-breakpoint
UPDATE `user_feature` SET `feature_key` = 'network' WHERE `feature_key` = 'headscale';
