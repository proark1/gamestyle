CREATE TABLE `audio_cues` (
	`game` text NOT NULL,
	`cue` text NOT NULL,
	`config` text NOT NULL,
	`file` text,
	`generated` integer,
	`generated_config` text,
	`error` text DEFAULT '' NOT NULL,
	`request` text,
	PRIMARY KEY(`game`, `cue`)
);
--> statement-breakpoint
CREATE TABLE `audio_settings` (
	`game` text PRIMARY KEY NOT NULL,
	`secret` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
