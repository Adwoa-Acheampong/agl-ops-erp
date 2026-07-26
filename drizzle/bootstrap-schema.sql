-- Auto-generated full-schema bootstrap. Idempotent: every CREATE

-- guards with IF NOT EXISTS; safe to run on cold or partial DBs.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `_migrations_applied` (
  `tag` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checksum` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appointment_diagnostics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appointmentId` int NOT NULL,
  `faultCode` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL,
  `workOrder` text COLLATE utf8mb4_unicode_ci,
  `sequence` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sequenceNo` int DEFAULT NULL,
  `systemComponent` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actionRequired` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `appointment_diagnostics_appointmentId_fk` (`appointmentId`),
  CONSTRAINT `appointment_diagnostics_appointmentId_fk` FOREIGN KEY (`appointmentId`) REFERENCES `service_appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appointment_parts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appointmentId` int NOT NULL,
  `inventoryItemId` int DEFAULT NULL,
  `partName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buyPrice` decimal(10,2) NOT NULL,
  `sellPrice` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sirId` int DEFAULT NULL,
  `qtyReturned` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `appointment_parts_appointmentId_fk` (`appointmentId`),
  KEY `appointment_parts_sirId_idx` (`sirId`),
  CONSTRAINT `appointment_parts_appointmentId_fk` FOREIGN KEY (`appointmentId`) REFERENCES `service_appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appointment_recalls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `originalAppointmentId` int NOT NULL,
  `recallReason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `penaltyAmount` decimal(10,2) NOT NULL,
  `mechanicIds` json NOT NULL,
  `status` enum('open','resolved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `appointment_recalls_originalAppointmentId_fk` (`originalAppointmentId`),
  CONSTRAINT `appointment_recalls_originalAppointmentId_fk` FOREIGN KEY (`originalAppointmentId`) REFERENCES `service_appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `userId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('mutation','auth','access') COLLATE utf8mb4_unicode_ci NOT NULL,
  `meta` json DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_log_at_idx` (`at`),
  KEY `audit_log_action_idx` (`action`),
  KEY `audit_log_category_idx` (`category`),
  KEY `audit_log_userId_at_idx` (`userId`,`at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bot_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userId` int DEFAULT NULL,
  `channel` enum('web','whatsapp','slack','api') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'web',
  `command` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inputText` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `outputText` text COLLATE utf8mb4_unicode_ci,
  `tokensUsed` int DEFAULT NULL,
  `latencyMs` int DEFAULT NULL,
  `errorMessage` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bot_logs_userId_idx` (`userId`),
  KEY `bot_logs_command_idx` (`command`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `communication_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `customerId` int NOT NULL,
  `appointmentId` int DEFAULT NULL,
  `channel` enum('sms','whatsapp','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('sent','delivered','failed','pending') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` text COLLATE utf8mb4_unicode_ci,
  `externalId` text COLLATE utf8mb4_unicode_ci,
  `tenantId` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `communication_log_customerId_customers_id_fk` (`customerId`),
  KEY `communication_log_appointmentId_service_appointments_id_fk` (`appointmentId`),
  CONSTRAINT `communication_log_appointmentId_service_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `service_appointments` (`id`),
  CONSTRAINT `communication_log_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `complaints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` int DEFAULT NULL,
  `vsrId` int DEFAULT NULL,
  `raisedBy` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','in_progress','resolved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `resolvedAt` datetime DEFAULT NULL,
  `resolvedBy` int DEFAULT NULL,
  `resolutionNotes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `complaints_tenant_status_idx` (`tenantId`,`status`),
  KEY `complaints_customerId_idx` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_contact` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `amount_paid` decimal(10,2) DEFAULT '0.00',
  `amount_due` decimal(10,2) NOT NULL,
  `sale_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('Pending','Partially Paid','Fully Paid','Overdue') COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_complaints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `complaintNo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` int DEFAULT NULL,
  `customerName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerContact` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicleId` int DEFAULT NULL,
  `vehicleLabel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previousInvoiceRef` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('walk_in','whatsapp','phone','email','remote','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'walk_in',
  `loggedBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loggedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `categories` json DEFAULT NULL,
  `customerWords` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `staffInvolved` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `immediateActions` json DEFAULT NULL,
  `actionDescription` text COLLATE utf8mb4_unicode_ci,
  `promisedResolution` date DEFAULT NULL,
  `resolutionDeadline` date DEFAULT NULL,
  `actualResolution` text COLLATE utf8mb4_unicode_ci,
  `resolvedAt` date DEFAULT NULL,
  `customerSatisfied` tinyint(1) DEFAULT NULL,
  `status` enum('open','in_progress','resolved','escalated','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `reviewedBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `escalatedToCeo` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `complaints_no_uidx` (`complaintNo`),
  KEY `complaints_tenant_idx` (`tenantId`),
  KEY `complaints_status_idx` (`status`),
  KEY `complaints_customer_idx` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `customerId` int NOT NULL,
  `planId` int NOT NULL,
  `status` enum('active','paused','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `startDate` date NOT NULL,
  `nextBillingDate` date DEFAULT NULL,
  `paymentMethod` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autoRenew` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `customer_subscriptions_tenantId_tenants_id_fk` (`tenantId`),
  KEY `customer_subscriptions_customerId_customers_id_fk` (`customerId`),
  KEY `customer_subscriptions_planId_subscription_plans_id_fk` (`planId`),
  CONSTRAINT `customer_subscriptions_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`),
  CONSTRAINT `customer_subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `customer_subscriptions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredContact` enum('sms','whatsapp','email') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notificationsEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `tenantId` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_phone_unique` (`phone`),
  KEY `customers_tenantId_idx` (`tenantId`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `daily_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `entryDate` date NOT NULL,
  `category` enum('opening','cash_reconciliation','sales_summary','inventory_check','closing','handover','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `loggedBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `amountGhs` decimal(12,2) DEFAULT NULL,
  `flagged` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `de_tenant_date_idx` (`tenantId`,`entryDate`),
  KEY `de_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expense_date` date NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `external_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cashSource` enum('petty_cash','sales_cash','bank','momo','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deductedFromSales` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `expenses_external_id_uidx` (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fixbot_conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int DEFAULT NULL,
  `userId` int NOT NULL,
  `title` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fixbot_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversationId` int NOT NULL,
  `role` enum('user','assistant','tool') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `toolName` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toolInput` json DEFAULT NULL,
  `toolResult` json DEFAULT NULL,
  `tokensIn` int DEFAULT NULL,
  `tokensOut` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `form_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `formId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `formLabel` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valuesJson` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `signature` text COLLATE utf8mb4_unicode_ci,
  `submittedBy` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approvedBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approvedAt` timestamp NULL DEFAULT NULL,
  `status` enum('draft','submitted','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'submitted',
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `form_submissions_tenant_idx` (`tenantId`,`formId`),
  KEY `form_submissions_status_idx` (`status`),
  CONSTRAINT `form_submissions_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  `min_stock_level` decimal(10,2) NOT NULL DEFAULT '0.00',
  `unit_price` decimal(10,2) NOT NULL,
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_restock_date` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `vehicleMake` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicleModel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yearMin` int DEFAULT NULL,
  `yearMax` int DEFAULT NULL,
  `engineCapacity` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cleanDescription` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_item_code_unique` (`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sortOrder` int DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_fitment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inventoryItemId` int NOT NULL,
  `make` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yearMin` int DEFAULT NULL,
  `yearMax` int DEFAULT NULL,
  `engineCapacity` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_fitment_natural_uidx` (`inventoryItemId`,`make`,`model`,`yearMin`,`yearMax`,`engineCapacity`),
  KEY `inventory_fitment_make_idx` (`make`),
  CONSTRAINT `inventory_fitment_inventoryItemId_fk` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kpi_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `metric` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target` decimal(14,2) NOT NULL,
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GHS',
  `period` enum('daily','weekly','monthly','quarterly','yearly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kpi_metric_uidx` (`tenantId`,`metric`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `marketing_spend` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `campaignName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('facebook','google','whatsapp','radio') COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget` decimal(12,2) NOT NULL,
  `spent` decimal(12,2) NOT NULL DEFAULT '0.00',
  `leads` int DEFAULT '0',
  `roi` decimal(10,4) DEFAULT NULL,
  `flaggedForReview` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `marketing_spend_tenantId_tenants_id_fk` (`tenantId`),
  CONSTRAINT `marketing_spend_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `monthly_summary` (
  `id` int NOT NULL AUTO_INCREMENT,
  `month` date NOT NULL,
  `total_revenue` decimal(12,2) DEFAULT NULL,
  `total_transactions` int DEFAULT NULL,
  `avg_transaction_value` decimal(10,2) DEFAULT NULL,
  `total_vehicles_serviced` int DEFAULT NULL,
  `working_days` int DEFAULT NULL,
  `avg_vehicles_per_day` decimal(5,2) DEFAULT NULL,
  `total_expenses` decimal(12,2) DEFAULT NULL,
  `total_po_spend` decimal(12,2) DEFAULT NULL,
  `net_position` decimal(12,2) DEFAULT NULL,
  `summary_data` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `monthly_summary_month_unique` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_reads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notificationId` int NOT NULL,
  `userId` int NOT NULL,
  `readAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_reads_unique` (`notificationId`,`userId`),
  KEY `notification_reads_userId_fk` (`userId`),
  CONSTRAINT `notification_reads_notificationId_fk` FOREIGN KEY (`notificationId`) REFERENCES `notifications` (`id`),
  CONSTRAINT `notification_reads_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('revenue_alert','attendance_alert','vehicle_alert','payment_alert','inventory_alert','general') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendorName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendorContact` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalAmount` decimal(12,2) NOT NULL,
  `amountPaid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amountDue` decimal(12,2) NOT NULL,
  `incurredOn` date NOT NULL,
  `dueDate` date DEFAULT NULL,
  `status` enum('Pending','Partially Paid','Fully Paid','Overdue') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `category` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payables_status_idx` (`status`),
  KEY `payables_dueDate_idx` (`dueDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `baseMonthlyNet` decimal(10,2) NOT NULL,
  `bonusShare` decimal(10,2) NOT NULL DEFAULT '0.00',
  `overtimePay` decimal(10,2) NOT NULL DEFAULT '0.00',
  `latePenalty` decimal(10,2) NOT NULL DEFAULT '0.00',
  `noClockOutPenalty` decimal(10,2) NOT NULL DEFAULT '0.00',
  `recallPenaltyShare` decimal(10,2) NOT NULL DEFAULT '0.00',
  `netPay` decimal(10,2) NOT NULL,
  `finalizedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finalizedBy` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payroll_runs_tenantId_fk` (`tenantId`),
  KEY `payroll_runs_staffId_fk` (`staffId`),
  CONSTRAINT `payroll_runs_staffId_fk` FOREIGN KEY (`staffId`) REFERENCES `staff` (`id`),
  CONSTRAINT `payroll_runs_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_date` date NOT NULL,
  `vendor` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('Pending','Approved','Received','Cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_date` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_orders_po_number_unique` (`po_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_date` date NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_contact` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('Walk-In','WhatsApp','Phone','Instagram','TikTok','Boss','Delivery','Order') COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `part_service` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('Cash','MoMo','Bank Transfer','Credit','POS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sales_rep` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mechanic` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Completed','Pending Payment','Pending','Cancelled','Queued','Awaiting','Delivered') COLLATE utf8mb4_unicode_ci NOT NULL,
  `workmanship_fee` decimal(10,2) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `external_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_transactions_external_id_uidx` (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `customerId` int NOT NULL,
  `vehicleId` int NOT NULL,
  `scheduledDate` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduledTime` text COLLATE utf8mb4_unicode_ci,
  `serviceType` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Scheduled','Checked In','In Progress','Ready','Completed','Cancelled','intake','diagnosis','awaiting_approval','approved','in_progress','quality_check','awaiting_payment','released') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Scheduled',
  `assignedMechanic` text COLLATE utf8mb4_unicode_ci,
  `estimatedCost` decimal(10,2) DEFAULT NULL,
  `actualCost` decimal(10,2) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `notifiedAt` text COLLATE utf8mb4_unicode_ci,
  `tenantId` text COLLATE utf8mb4_unicode_ci,
  `customerComplaint` text COLLATE utf8mb4_unicode_ci,
  `observedSymptoms` text COLLATE utf8mb4_unicode_ci,
  `serviceFee` decimal(10,2) DEFAULT NULL,
  `vsrNo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intakeBy` int DEFAULT NULL,
  `dateIn` date DEFAULT NULL,
  `timeIn` time DEFAULT NULL,
  `expectedCollection` datetime DEFAULT NULL,
  `reasonForVisit` text COLLATE utf8mb4_unicode_ci,
  `preExistingDamage` text COLLATE utf8mb4_unicode_ci,
  `customerAuthSignedAt` datetime DEFAULT NULL,
  `quoteRef` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quotedAmountGhs` decimal(12,2) DEFAULT NULL,
  `approvedAmountGhs` decimal(12,2) DEFAULT NULL,
  `customerApprovedAt` datetime DEFAULT NULL,
  `partsTotalGhs` decimal(12,2) NOT NULL DEFAULT '0.00',
  `labourTotalGhs` decimal(12,2) NOT NULL DEFAULT '0.00',
  `jobTotalGhs` decimal(12,2) NOT NULL DEFAULT '0.00',
  `paymentMethod` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amountPaidGhs` decimal(12,2) NOT NULL DEFAULT '0.00',
  `balanceGhs` decimal(12,2) NOT NULL DEFAULT '0.00',
  `receiptNo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cashierId` int DEFAULT NULL,
  `paymentConfirmedAt` datetime DEFAULT NULL,
  `paystackReference` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicleCleaned` tinyint(1) NOT NULL DEFAULT '0',
  `testDrivePerformed` tinyint(1) NOT NULL DEFAULT '0',
  `careAdvice` text COLLATE utf8mb4_unicode_ci,
  `customerFeedback` text COLLATE utf8mb4_unicode_ci,
  `releasedAt` datetime DEFAULT NULL,
  `vifNo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateClosed` date DEFAULT NULL,
  `testDriveStatus` enum('yes','no','na') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supervisorSignoff` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salesRepNotified` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerCollected` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerCollectedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_appointments_vsrNo_uidx` (`vsrNo`),
  KEY `service_appointments_customerId_customers_id_fk` (`customerId`),
  KEY `service_appointments_vehicleId_vehicles_id_fk` (`vehicleId`),
  KEY `service_appointments_tenantId_status_idx` (`tenantId`(255),`status`),
  KEY `service_appointments_status_idx` (`status`),
  CONSTRAINT `service_appointments_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`),
  CONSTRAINT `service_appointments_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_catalog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `serviceName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priceGhs` decimal(12,2) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_name_uidx` (`tenantId`,`serviceName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sop_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `section` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pageRef` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sop_tenant_idx` (`tenantId`),
  FULLTEXT KEY `sop_documents_content_ft` (`content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('owner','manager','mechanic','receptionist','accountant','sales_attendant','sales_supervisor','workshop_supervisor','inventory_attendant') COLLATE utf8mb4_unicode_ci NOT NULL,
  `hireDate` date DEFAULT NULL,
  `status` enum('active','suspended','terminated') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `hourlyRate` decimal(10,2) DEFAULT NULL,
  `salaryType` enum('hourly','salary','monthly','commission') COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastClockIn` timestamp NULL DEFAULT NULL,
  `lastClockOut` timestamp NULL DEFAULT NULL,
  `baseMonthlyNet` decimal(10,2) DEFAULT NULL,
  `ghana_card_id` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ssnit` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `health_insurance` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work_start` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work_end` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `staff_tenantId_tenants_id_fk` (`tenantId`),
  CONSTRAINT `staff_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clock_in_date` date NOT NULL,
  `clock_in_time` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clock_out_time` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hours_worked` decimal(5,2) DEFAULT NULL,
  `is_late` tinyint(1) DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `external_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_attendance_external_id_uidx` (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_attendance_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `staffId` int NOT NULL,
  `clockInTime` timestamp NULL DEFAULT NULL,
  `clockOutTime` timestamp NULL DEFAULT NULL,
  `locationGPS` text COLLATE utf8mb4_unicode_ci,
  `deviceFingerprint` text COLLATE utf8mb4_unicode_ci,
  `overtimeHours` decimal(5,2) DEFAULT NULL,
  `approvedBy` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `staff_attendance_logs_staffId_staff_id_fk` (`staffId`),
  KEY `staff_attendance_logs_approvedBy_staff_id_fk` (`approvedBy`),
  CONSTRAINT `staff_attendance_logs_approvedBy_staff_id_fk` FOREIGN KEY (`approvedBy`) REFERENCES `staff` (`id`),
  CONSTRAINT `staff_attendance_logs_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `docType` enum('contract','national_id','ghana_card','drivers_license','certification','medical','training','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` int NOT NULL,
  `storage_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` date DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `staff_documents_staff_fk` (`staffId`),
  KEY `staff_documents_tenant_idx` (`tenantId`,`staffId`),
  KEY `staff_documents_expiry_idx` (`expires_at`),
  CONSTRAINT `staff_documents_staff_fk` FOREIGN KEY (`staffId`) REFERENCES `staff` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `staffId` int NOT NULL,
  `monthStart` date NOT NULL,
  `monthEnd` date NOT NULL,
  `jobsCompleted` int DEFAULT '0',
  `avgJobTime` decimal(10,2) DEFAULT NULL,
  `customerRating` decimal(3,2) DEFAULT NULL,
  `revenueGenerated` decimal(12,2) DEFAULT NULL,
  `deductionsApplied` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `staff_performance_staffId_staff_id_fk` (`staffId`),
  CONSTRAINT `staff_performance_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `shiftDate` date NOT NULL,
  `startTime` time DEFAULT NULL,
  `endTime` time DEFAULT NULL,
  `role` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('planned','confirmed','swapped','cancelled','no_show') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sched_staff_date_idx` (`staffId`,`shiftDate`),
  KEY `sched_tenant_date_idx` (`tenantId`,`shiftDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_training` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int NOT NULL,
  `staffId` int NOT NULL,
  `sessionCode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sessionTitle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sessionDate` date NOT NULL,
  `deliveredBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competencyLevel` enum('aware','practising','competent','expert') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passed` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `signedOffBy` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signedOffAt` datetime DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `train_staff_idx` (`staffId`),
  KEY `train_session_idx` (`sessionCode`,`sessionDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_issue_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vsrId` int NOT NULL,
  `requestedBy` int NOT NULL,
  `approvedBy` int DEFAULT NULL,
  `status` enum('pending','approved','issued','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sir_vsrId_idx` (`vsrId`),
  KEY `sir_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monthlyPrice` decimal(10,2) NOT NULL,
  `yearlyPrice` decimal(10,2) NOT NULL,
  `benefitsJSON` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `subscription_plans_tenantId_tenants_id_fk` (`tenantId`),
  CONSTRAINT `subscription_plans_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdBy` int NOT NULL,
  `assignedTo` int DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `dueDatetime` datetime DEFAULT NULL,
  `status` enum('open','done','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `completedAt` datetime DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tasks_tenant_status_idx` (`tenantId`,`status`),
  KEY `tasks_assignedTo_idx` (`assignedTo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `businessName` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownerEmail` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionTier` enum('free','starter','pro','enterprise') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'free',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `brandingJSON` text COLLATE utf8mb4_unicode_ci,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId` int NOT NULL,
  `appointmentId` int DEFAULT NULL,
  `type` enum('sale','refund','expense','payroll','subscription') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GHS',
  `paymentMethod` enum('cash','mobile_money','card') COLLATE utf8mb4_unicode_ci NOT NULL,
  `processedBy` int DEFAULT NULL,
  `status` enum('pending','completed','flagged') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `transactions_appointmentId_service_appointments_id_fk` (`appointmentId`),
  KEY `transactions_processedBy_staff_id_fk` (`processedBy`),
  KEY `transactions_tenantId_type_idx` (`tenantId`,`type`),
  CONSTRAINT `transactions_appointmentId_service_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `service_appointments` (`id`),
  CONSTRAINT `transactions_processedBy_staff_id_fk` FOREIGN KEY (`processedBy`) REFERENCES `staff` (`id`),
  CONSTRAINT `transactions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loginMethod` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','admin','owner','manager','staff','operations_manager','sales_supervisor','workshop_supervisor','sales_rep','mechanic','cashier') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  `passwordHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `customerId` int NOT NULL,
  `registrationNo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `make` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` text COLLATE utf8mb4_unicode_ci,
  `year` text COLLATE utf8mb4_unicode_ci,
  `color` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `tenantId` text COLLATE utf8mb4_unicode_ci,
  `chassisNumber` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `engineCapacity` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicles_registrationNo_unique` (`registrationNo`),
  KEY `vehicles_customerId_customers_id_fk` (`customerId`),
  CONSTRAINT `vehicles_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int DEFAULT NULL,
  `templateId` int DEFAULT NULL,
  `customerId` int DEFAULT NULL,
  `vehicleId` int DEFAULT NULL,
  `toPhone` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `renderedBody` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('queued','sending','sent','delivered','read','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `retryCount` int NOT NULL DEFAULT '0',
  `failureReason` text COLLATE utf8mb4_unicode_ci,
  `metaMessageId` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduledFor` timestamp NULL DEFAULT NULL,
  `sentAt` timestamp NULL DEFAULT NULL,
  `deliveredAt` timestamp NULL DEFAULT NULL,
  `readAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenantId` int DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('service_due','payment_reminder','renewal','follow_up','general') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `approvedByMeta` tinyint(1) DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workshop_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_date` date NOT NULL,
  `vehicle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registration_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mechanics` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Completed','In Progress','Pending','On Hold') COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `completed_at` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `external_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshop_jobs_external_id_uidx` (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
