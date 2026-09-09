CREATE TABLE `audio_generation_jobs` (
	`game` text NOT NULL,
	`request` text NOT NULL,
	`cancelled` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`game`, `request`)
);
