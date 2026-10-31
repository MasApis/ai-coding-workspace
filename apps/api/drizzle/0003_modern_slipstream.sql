CREATE TABLE `design_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`spec_md` text NOT NULL,
	`prototype_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `design_versions_project_id_idx` ON `design_versions` (`project_id`);