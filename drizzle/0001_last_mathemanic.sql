CREATE TABLE `credit_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_name` varchar(255) NOT NULL,
	`customer_contact` varchar(20),
	`total_amount` decimal(10,2) NOT NULL,
	`amount_paid` decimal(10,2) DEFAULT '0',
	`amount_due` decimal(10,2) NOT NULL,
	`sale_date` date NOT NULL,
	`due_date` date,
	`status` enum('Pending','Partially Paid','Fully Paid','Overdue') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expense_date` date NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`payment_method` varchar(50),
	`vendor` varchar(255),
	`approved_by` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_name` varchar(255) NOT NULL,
	`item_code` varchar(50) NOT NULL,
	`category` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`min_stock_level` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`supplier` varchar(255),
	`last_restock_date` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_item_code_unique` UNIQUE(`item_code`)
);
--> statement-breakpoint
CREATE TABLE `monthly_summary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` date NOT NULL,
	`total_revenue` decimal(12,2),
	`total_transactions` int,
	`avg_transaction_value` decimal(10,2),
	`total_vehicles_serviced` int,
	`working_days` int,
	`avg_vehicles_per_day` decimal(5,2),
	`total_expenses` decimal(12,2),
	`total_po_spend` decimal(12,2),
	`net_position` decimal(12,2),
	`summary_data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_summary_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthly_summary_month_unique` UNIQUE(`month`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` enum('revenue_alert','attendance_alert','vehicle_alert','payment_alert','inventory_alert','general') NOT NULL,
	`recipient_role` varchar(50) NOT NULL,
	`is_read` boolean DEFAULT false,
	`read_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`po_number` varchar(50) NOT NULL,
	`po_date` date NOT NULL,
	`vendor` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('Pending','Approved','Received','Cancelled') NOT NULL,
	`delivery_date` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_po_number_unique` UNIQUE(`po_number`)
);
--> statement-breakpoint
CREATE TABLE `sales_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transaction_date` date NOT NULL,
	`customer_name` varchar(255),
	`customer_contact` varchar(20),
	`channel` enum('Walk-In','WhatsApp','Phone','Instagram','TikTok','Boss') NOT NULL,
	`vehicle` varchar(255),
	`part_service` text NOT NULL,
	`quantity` decimal(10,2),
	`unit_price` decimal(10,2),
	`total_amount` decimal(10,2) NOT NULL,
	`payment_method` enum('Cash','MoMo','Bank Transfer','Credit','POS') NOT NULL,
	`receipt_no` varchar(50),
	`sales_rep` varchar(100),
	`mechanic` varchar(100),
	`status` enum('Completed','Pending Payment','Pending','Cancelled','Queued','Awaiting','Delivered') NOT NULL,
	`workmanship_fee` decimal(10,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_name` varchar(100) NOT NULL,
	`role` varchar(100) NOT NULL,
	`clock_in_date` date NOT NULL,
	`clock_in_time` varchar(10),
	`clock_out_time` varchar(10),
	`hours_worked` decimal(5,2),
	`is_late` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshop_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_date` date NOT NULL,
	`vehicle` varchar(255) NOT NULL,
	`registration_no` varchar(50),
	`mechanics` text NOT NULL,
	`job_description` text NOT NULL,
	`status` enum('Completed','In Progress','Pending','On Hold') NOT NULL,
	`notes` text,
	`completed_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workshop_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager','staff') NOT NULL DEFAULT 'user';