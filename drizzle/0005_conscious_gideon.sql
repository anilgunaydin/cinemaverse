CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_json` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`user_id`,`subscription_json`);--> statement-breakpoint
CREATE TABLE `title_watch_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`provider_id` integer NOT NULL,
	`monetization_type` text NOT NULL,
	`link` text,
	`quality` text,
	`region` text DEFAULT 'TR' NOT NULL,
	`last_checked` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_watch_providers_unique` ON `title_watch_providers` (`title_id`,`provider_id`,`monetization_type`);--> statement-breakpoint
CREATE INDEX `title_watch_providers_title_idx` ON `title_watch_providers` (`title_id`);--> statement-breakpoint
CREATE INDEX `title_watch_providers_provider_idx` ON `title_watch_providers` (`provider_id`);--> statement-breakpoint
CREATE TABLE `watch_providers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logo_path` text,
	`display_priority` integer,
	`monetization_types` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `watch_providers_name_idx` ON `watch_providers` (`name`);