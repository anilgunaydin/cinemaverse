ALTER TABLE `user_list_items` ADD `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `user_lists` ADD `moderation_status` text DEFAULT 'visible' NOT NULL;