CREATE TABLE `players` (
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
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_room_idx` ON `players` (`room`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_room_slot_idx` ON `players` (`room`,`slot`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`world` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
