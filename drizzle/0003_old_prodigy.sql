CREATE TABLE `external_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`author` text,
	`section` text,
	`language` text DEFAULT 'en' NOT NULL,
	`body` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `external_comments_title_idx` ON `external_comments` (`title_id`);--> statement-breakpoint
CREATE INDEX `external_comments_lang_idx` ON `external_comments` (`language`);