CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`task_name` text NOT NULL,
	`project` text,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`last_activity` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
