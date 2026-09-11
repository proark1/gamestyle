CREATE TABLE `analytics_events` (
	`session` text NOT NULL,
	`seq` integer NOT NULL,
	`at` integer NOT NULL,
	`type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`session`, `seq`),
	FOREIGN KEY (`session`) REFERENCES `analytics_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analytics_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`started` integer NOT NULL,
	`updated` integer NOT NULL,
	`delivery` integer DEFAULT 0 NOT NULL,
	`device` text DEFAULT 'pointer' NOT NULL,
	`entry` text DEFAULT 'direct' NOT NULL,
	`mode` text DEFAULT '' NOT NULL,
	`room` text DEFAULT '' NOT NULL,
	`reached` text DEFAULT '[]' NOT NULL,
	`furthest` text DEFAULT 'opened' NOT NULL,
	`furthest_rank` integer DEFAULT 0 NOT NULL,
	`last_step` text DEFAULT 'opened' NOT NULL,
	`rounds` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`humans` integer DEFAULT 0 NOT NULL,
	`npcs` integer DEFAULT 0 NOT NULL,
	`elapsed` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`menu_ms` integer DEFAULT 0 NOT NULL,
	`lobby_ms` integer DEFAULT 0 NOT NULL,
	`playing_ms` integer DEFAULT 0 NOT NULL,
	`finished_ms` integer DEFAULT 0 NOT NULL,
	`actions` text DEFAULT '{}' NOT NULL,
	`results` text DEFAULT '{}' NOT NULL,
	`exit` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_sessions_started_idx` ON `analytics_sessions` (`started`);--> statement-breakpoint
CREATE INDEX `analytics_sessions_game_started_idx` ON `analytics_sessions` (`game`,`started`);--> statement-breakpoint
CREATE INDEX `analytics_sessions_updated_idx` ON `analytics_sessions` (`updated`);