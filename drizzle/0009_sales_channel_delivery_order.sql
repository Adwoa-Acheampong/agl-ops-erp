-- Widen the sales_transactions channel enum so the AGL monthly sales
-- ledger imports losslessly. The ledger records "Delivery" (parts run out
-- to a customer) and the odd "Order" as their own channels — neither was
-- in the original set, so an import would fail with "Data truncated for
-- column 'channel'". Adding them is additive: every existing value stays
-- valid and no rows are rewritten.
--
-- Idempotent: MODIFY to the same definition is a harmless no-op on re-run,
-- so this is safe as a boot-time migration (apply-all-migrations.mjs).
ALTER TABLE `sales_transactions`
  MODIFY COLUMN `channel` ENUM(
    'Walk-In','WhatsApp','Phone','Instagram','TikTok','Boss',
    'Delivery','Order'
  ) NOT NULL;
