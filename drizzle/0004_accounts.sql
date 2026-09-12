CREATE TABLE `account_email_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`flow_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`used` integer
);
--> statement-breakpoint
CREATE INDEX `account_email_codes_email_created_idx` ON `account_email_codes` (`email_hash`,`created`);--> statement-breakpoint
CREATE INDEX `account_email_codes_created_idx` ON `account_email_codes` (`created`);--> statement-breakpoint
CREATE TABLE `account_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	`email_hint` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`last_used` integer NOT NULL,
	PRIMARY KEY(`provider`, `subject`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_identities_account_idx` ON `account_identities` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`created` integer NOT NULL,
	`renewed` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_sessions_account_idx` ON `account_sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `account_sessions_expires_idx` ON `account_sessions` (`expires`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
