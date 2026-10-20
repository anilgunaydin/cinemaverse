CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text,
	`heading` text NOT NULL,
	`spoiler_mode` text DEFAULT 'progress' NOT NULL,
	`spoiler_season` integer,
	`provider` text,
	`model` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_conversations_user_idx` ON `ai_conversations` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations` text,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`provider` text,
	`model` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_user_idx` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `blocks` (
	`user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_user_id`)
);
--> statement-breakpoint
CREATE TABLE `credits` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`character_name` text DEFAULT '' NOT NULL,
	`billing_order` integer,
	`provider` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credits_unique` ON `credits` (`title_id`,`person_id`,`role`,`character_name`);--> statement-breakpoint
CREATE INDEX `credits_person_idx` ON `credits` (`person_id`);--> statement-breakpoint
CREATE INDEX `credits_title_idx` ON `credits` (`title_id`);--> statement-breakpoint
CREATE TABLE `data_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`requires_key` integer DEFAULT false NOT NULL,
	`license_note` text,
	`attribution` text,
	`last_success_at` text,
	`last_error_at` text,
	`last_error` text,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_providers_name_unique` ON `data_providers` (`name`);--> statement-breakpoint
CREATE TABLE `discussion_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discussion_posts_thread_idx` ON `discussion_posts` (`thread_id`);--> statement-breakpoint
CREATE TABLE `discussion_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text,
	`heading` text NOT NULL,
	`body` text NOT NULL,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `threads_title_idx` ON `discussion_threads` (`title_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`)
);
--> statement-breakpoint
CREATE INDEX `follows_following_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `franchise_titles` (
	`franchise_id` text NOT NULL,
	`title_id` text NOT NULL,
	PRIMARY KEY(`franchise_id`, `title_id`)
);
--> statement-breakpoint
CREATE TABLE `franchises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`wikidata_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_tr` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_slug_unique` ON `genres` (`slug`);--> statement-breakpoint
CREATE TABLE `library_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`status` text DEFAULT 'not_watched' NOT NULL,
	`rating` real,
	`watched_at` text,
	`watched_period` text,
	`notes` text,
	`liked_aspects` text,
	`disliked_aspects` text,
	`memorable_scenes` text,
	`rewatch_intent` text,
	`progress_season` integer,
	`progress_episode` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entries_user_title_unique` ON `library_entries` (`user_id`,`title_id`);--> statement-breakpoint
CREATE INDEX `library_entries_user_status_idx` ON `library_entries` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `library_entries_title_idx` ON `library_entries` (`title_id`);--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `mutes` (
	`user_id` text NOT NULL,
	`muted_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `muted_user_id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tmdb_id` text,
	`tvmaze_id` text,
	`wikidata_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_wikidata_unique` ON `people` (`wikidata_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_tmdb_unique` ON `people` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `people_name_idx` ON `people` (lower("name"));--> statement-breakpoint
CREATE TABLE `preference_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile_json` text DEFAULT '{}' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`rated_title_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_cache_expiry_idx` ON `provider_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `provider_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`status` text NOT NULL,
	`http_status` integer,
	`duration_ms` integer,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_requests_provider_idx` ON `provider_requests` (`provider`);--> statement-breakpoint
CREATE TABLE `recommendation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`verdict` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_feedback_unique` ON `recommendation_feedback` (`user_id`,`title_id`,`verdict`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`kind` text DEFAULT 'safe' NOT NULL,
	`score` real NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`uncertainty_note` text,
	`reasons_json` text DEFAULT '[]' NOT NULL,
	`algorithm` text DEFAULT 'rules-v1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendations_user_title_unique` ON `recommendations` (`user_id`,`title_id`);--> statement-breakpoint
CREATE INDEX `recommendations_user_idx` ON `recommendations` (`user_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_items` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`heading` text,
	`excerpt` text,
	`author` text,
	`published_at` text,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`spoiler_risk` text DEFAULT 'unknown' NOT NULL,
	`license_note` text,
	`sentiment` text,
	`themes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_items_dedupe` ON `research_items` (`session_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `research_items_session_idx` ON `research_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `research_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`question` text,
	`status` text DEFAULT 'running' NOT NULL,
	`summary` text,
	`summary_generated_by_ai` integer DEFAULT false NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `review_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_replies_review_idx` ON `review_replies` (`review_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`body` text NOT NULL,
	`rating` real,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`spoiler_scope_season` integer,
	`visibility` text DEFAULT 'public' NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_title_idx` ON `reviews` (`title_id`);--> statement-breakpoint
CREATE INDEX `reviews_user_idx` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `schema_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `title_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text,
	`provider` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_aliases_unique` ON `title_aliases` (`title_id`,lower("name"));--> statement-breakpoint
CREATE INDEX `title_aliases_name_idx` ON `title_aliases` (lower("name"));--> statement-breakpoint
CREATE TABLE `title_genres` (
	`title_id` text NOT NULL,
	`genre_id` text NOT NULL,
	`provider` text,
	PRIMARY KEY(`title_id`, `genre_id`)
);
--> statement-breakpoint
CREATE INDEX `title_genres_genre_idx` ON `title_genres` (`genre_id`);--> statement-breakpoint
CREATE TABLE `title_traits` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`dimension` text NOT NULL,
	`score` real NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`user_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_traits_unique` ON `title_traits` (`title_id`,`dimension`,`source`,`user_id`);--> statement-breakpoint
CREATE INDEX `title_traits_title_idx` ON `title_traits` (`title_id`);--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`tmdb_id` text,
	`tvmaze_id` text,
	`imdb_id` text,
	`wikidata_id` text,
	`original_title` text NOT NULL,
	`localized_title` text,
	`original_language` text,
	`overview` text,
	`release_date` text,
	`release_year` integer,
	`end_date` text,
	`runtime_minutes` integer,
	`poster_url` text,
	`backdrop_url` text,
	`homepage_url` text,
	`parent_id` text,
	`season_number` integer,
	`episode_number` integer,
	`external_rating` real,
	`external_rating_count` integer,
	`external_rating_source` text,
	`metadata_provider` text,
	`metadata_updated_at` text,
	`metadata_verified` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `titles_tmdb_unique` ON `titles` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `titles_tvmaze_unique` ON `titles` (`tvmaze_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `titles_imdb_unique` ON `titles` (`imdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `titles_wikidata_unique` ON `titles` (`wikidata_id`);--> statement-breakpoint
CREATE INDEX `titles_kind_idx` ON `titles` (`kind`);--> statement-breakpoint
CREATE INDEX `titles_parent_idx` ON `titles` (`parent_id`);--> statement-breakpoint
CREATE INDEX `titles_original_title_idx` ON `titles` (lower("original_title"));--> statement-breakpoint
CREATE INDEX `titles_release_year_idx` ON `titles` (`release_year`);--> statement-breakpoint
CREATE TABLE `user_list_items` (
	`list_id` text NOT NULL,
	`title_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	PRIMARY KEY(`list_id`, `title_id`)
);
--> statement-breakpoint
CREATE TABLE `user_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_title_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`dimension` text NOT NULL,
	`score` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_title_dimensions_unique` ON `user_title_dimensions` (`user_id`,`title_id`,`dimension`);--> statement-breakpoint
CREATE INDEX `user_title_dimensions_user_idx` ON `user_title_dimensions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`library_visibility` text DEFAULT 'private' NOT NULL,
	`reviews_visibility` text DEFAULT 'public' NOT NULL,
	`bio` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower("email"));