-- 2026-05 HR compliance + working-envelope columns on `staff`.
-- All new columns nullable so the migration is non-breaking on existing rows.
-- Column naming matches the existing drizzle convention on this table
-- (camelCase identifiers for JS-defined columns, snake_case only where
-- the schema declares the name explicitly).
ALTER TABLE `staff`
  ADD COLUMN `ghana_card_id`    varchar(24)  NULL,
  ADD COLUMN `ssnit`            varchar(24)  NULL,
  ADD COLUMN `health_insurance` varchar(64)  NULL,
  ADD COLUMN `work_start`       varchar(5)   NULL,
  ADD COLUMN `work_end`         varchar(5)   NULL;

-- Extend the salary_type enum so HR can mark `monthly` staff distinct from
-- the legacy `salary` bucket. The drizzle column is declared as
-- `salaryType` (camelCase), so reference that exact identifier.
ALTER TABLE `staff`
  MODIFY COLUMN `salaryType` ENUM('hourly','salary','monthly','commission') NOT NULL;
