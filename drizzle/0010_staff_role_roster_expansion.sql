-- Widen roster staff roles for AGL operations.
--
-- The HR roster form now includes operational floor roles beyond the old
-- owner/manager/mechanic/receptionist/accountant set. This migration keeps
-- every existing value valid and adds the requested roster roles.
ALTER TABLE `staff`
  MODIFY COLUMN `role` ENUM(
    'owner',
    'manager',
    'mechanic',
    'receptionist',
    'accountant',
    'sales_attendant',
    'sales_supervisor',
    'workshop_supervisor',
    'inventory_attendant'
  ) NOT NULL;
