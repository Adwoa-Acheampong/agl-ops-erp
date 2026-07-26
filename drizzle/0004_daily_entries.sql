-- WS2-C: daily operational log.
-- NOTE: the live table uses camelCase column names (entryDate, amountGhs,
-- loggedBy, summary, details) because a prior `drizzle-kit push` created
-- it that way. The bootstrap-schema.sql dump captures the live shape;
-- this migration only exists for fresh installs and stays aligned with
-- it. The original snake_case version of this file was retained in git
-- history if you need to inspect the divergence.
CREATE TABLE IF NOT EXISTS `daily_entries` (
  `id`              int AUTO_INCREMENT NOT NULL,
  `createdAt`       timestamp NOT NULL DEFAULT (now()),
  `updatedAt`       timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId`        int NOT NULL,
  `entryDate`       date NOT NULL,
  `category`        ENUM('opening','cash_reconciliation','sales_summary','inventory_check','closing','handover','other') NOT NULL,
  `summary`         varchar(255),
  `details`         text,
  `amountGhs`       decimal(12,2),
  `flagged`         tinyint NOT NULL DEFAULT 0,
  `loggedBy`        varchar(160),
  CONSTRAINT `daily_entries_id` PRIMARY KEY (`id`),
  CONSTRAINT `daily_entries_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
);
CREATE INDEX `daily_entries_tenant_date_idx` ON `daily_entries` (`tenantId`, `entryDate`);
CREATE INDEX `daily_entries_category_idx`    ON `daily_entries` (`category`);
