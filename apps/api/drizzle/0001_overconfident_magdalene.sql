CREATE TABLE `ai_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_preferences_scope_idx` ON `ai_preferences` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`error_code` text,
	`tokens_in` integer,
	`tokens_out` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_requests_project_id_idx` ON `ai_requests` (`project_id`);--> statement-breakpoint
CREATE INDEX `ai_requests_started_at_idx` ON `ai_requests` (`started_at`);--> statement-breakpoint
CREATE TABLE `model_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`label` text,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_presets_provider_id_idx` ON `model_presets` (`provider_id`);--> statement-breakpoint
CREATE TABLE `provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`protocol` text NOT NULL,
	`base_url` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_configs_updated_at_idx` ON `provider_configs` (`updated_at`);--> statement-breakpoint
CREATE TABLE `provider_secrets` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_secrets_created_at_idx` ON `provider_secrets` (`created_at`);