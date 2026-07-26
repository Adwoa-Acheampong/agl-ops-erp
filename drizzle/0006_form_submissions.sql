-- WS4-C: persistent storage for in-app form submissions.
CREATE TABLE `form_submissions` (
  `id`            int AUTO_INCREMENT NOT NULL,
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  `updatedAt`     timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId`      int NOT NULL,
  `formId`        varchar(64) NOT NULL,
  `formLabel`     varchar(200) NOT NULL,
  `valuesJson`    text NOT NULL,
  `signature`     text,
  `submittedBy`   varchar(160) NOT NULL,
  `approvedBy`    varchar(160),
  `approvedAt`    timestamp NULL,
  `status`        ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
  `notes`         text,
  CONSTRAINT `form_submissions_id` PRIMARY KEY (`id`),
  CONSTRAINT `form_submissions_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`)
);
CREATE INDEX `form_submissions_tenant_idx` ON `form_submissions` (`tenantId`, `formId`);
CREATE INDEX `form_submissions_status_idx` ON `form_submissions` (`status`);
