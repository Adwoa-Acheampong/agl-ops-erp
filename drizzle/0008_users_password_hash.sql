-- Ensure the users table carries a passwordHash column (added in the
-- 2026-05 zero-dependency auth migration). Idempotent — if the column
-- already exists, the runner's ER_DUP_FIELDNAME guard treats it as a
-- no-op.
ALTER TABLE `users`
  ADD COLUMN `passwordHash` varchar(255) NULL;

-- Widen the role enum so the canonical AGL roster (operations_manager,
-- sales_supervisor, workshop_supervisor, sales_rep, mechanic, cashier)
-- has a slot. The legacy values stay valid.
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM(
    'user','admin','manager','staff',
    'operations_manager','sales_supervisor','workshop_supervisor',
    'sales_rep','mechanic','cashier'
  ) NOT NULL DEFAULT 'user';
