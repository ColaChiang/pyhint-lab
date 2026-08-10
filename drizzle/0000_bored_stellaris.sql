CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`problem_id` text NOT NULL,
	`code` text NOT NULL,
	`passed` integer NOT NULL,
	`total` integer NOT NULL,
	`rule_id` text,
	`hint_level` integer NOT NULL,
	`created_at` integer NOT NULL
);
