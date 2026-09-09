CREATE TABLE `handwerker_fp_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`slot` integer NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`z` real NOT NULL,
	`yaw` real NOT NULL,
	`pitch` real NOT NULL,
	`seen` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `handwerker_fp_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handwerker_fp_players_room_slot` ON `handwerker_fp_players` (`room`,`slot`);--> statement-breakpoint
CREATE TABLE `handwerker_fp_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`world` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handwerker_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`slot` integer NOT NULL,
	`x` real NOT NULL,
	`z` real NOT NULL,
	`angle` real NOT NULL,
	`jump` integer DEFAULT 0 NOT NULL,
	`seen` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `handwerker_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handwerker_players_room_idx` ON `handwerker_players` (`room`);--> statement-breakpoint
CREATE UNIQUE INDEX `handwerker_players_room_slot_idx` ON `handwerker_players` (`room`,`slot`);--> statement-breakpoint
CREATE TABLE `handwerker_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`world` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handwerker_saved_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`source_id` text,
	`snapshot` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `handwerker_saved_builds_owner_created_idx` ON `handwerker_saved_builds` (`owner_hash`,`created`);