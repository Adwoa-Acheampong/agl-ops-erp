-- WS5-A: per-employee document store. Metadata only; binary lives at
-- `storage_path` (uploads dir / S3 / Drive — adapter decides).
CREATE TABLE `staff_documents` (
  `id`            int AUTO_INCREMENT NOT NULL,
  `createdAt`     timestamp NOT NULL DEFAULT (now()),
  `updatedAt`     timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `tenantId`      int NOT NULL,
  `staffId`       int NOT NULL,
  `docType`       ENUM('contract','national_id','ghana_card','drivers_license','certification','medical','training','other') NOT NULL,
  `filename`      varchar(200) NOT NULL,
  `mime_type`     varchar(100) NOT NULL,
  `size_bytes`    int NOT NULL,
  `storage_path`  varchar(500) NOT NULL,
  `expires_at`    date,
  `uploaded_by`   int,
  `notes`         text,
  CONSTRAINT `staff_documents_id` PRIMARY KEY (`id`),
  CONSTRAINT `staff_documents_staff_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`)
);
CREATE INDEX `staff_documents_tenant_idx` ON `staff_documents` (`tenantId`, `staffId`);
CREATE INDEX `staff_documents_expiry_idx` ON `staff_documents` (`expires_at`);
