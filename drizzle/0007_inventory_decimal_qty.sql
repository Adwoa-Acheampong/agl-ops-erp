-- Allow fractional inventory quantities (e.g. 1.5 L of engine oil,
-- 0.25 kg of grease). Both `quantity` and `min_stock_level` switch
-- from INT to DECIMAL(10,2). Existing integer values stay valid.
ALTER TABLE `inventory`
  MODIFY COLUMN `quantity`        decimal(10,2) NOT NULL DEFAULT 0,
  MODIFY COLUMN `min_stock_level` decimal(10,2) NOT NULL DEFAULT 0;
