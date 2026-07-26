CREATE TABLE `communication_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`customerId` int NOT NULL,
	`appointmentId` int,
	`channel` enum('sms','whatsapp','email') NOT NULL,
	`message` text NOT NULL,
	`status` enum('sent','delivered','failed','pending') NOT NULL,
	`provider` text,
	`externalId` text,
	CONSTRAINT `communication_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`name` text NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`preferredContact` enum('sms','whatsapp','email'),
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`notes` text,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `service_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`customerId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`scheduledDate` text NOT NULL,
	`scheduledTime` text,
	`serviceType` text NOT NULL,
	`status` enum('Scheduled','Checked In','In Progress','Ready','Completed','Cancelled') NOT NULL,
	`assignedMechanic` text,
	`estimatedCost` decimal(10,2),
	`actualCost` decimal(10,2),
	`notes` text,
	`notifiedAt` text,
	CONSTRAINT `service_appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`customerId` int NOT NULL,
	`registrationNo` varchar(50) NOT NULL,
	`make` text NOT NULL,
	`model` text,
	`year` text,
	`color` text,
	`notes` text,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_registrationNo_unique` UNIQUE(`registrationNo`)
);
--> statement-breakpoint
ALTER TABLE `communication_log` ADD CONSTRAINT `communication_log_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communication_log` ADD CONSTRAINT `communication_log_appointmentId_service_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `service_appointments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_appointments` ADD CONSTRAINT `service_appointments_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_appointments` ADD CONSTRAINT `service_appointments_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;