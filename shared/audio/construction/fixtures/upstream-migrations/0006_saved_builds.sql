CREATE TABLE `saved_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`source_id` text,
	`snapshot` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_builds_owner_created_idx` ON `saved_builds` (`owner_hash`,`created`);