/**
 * Runtime config for insight thresholds.
 * In-memory; survives until process restart.
 * Replace with DB-backed config when persistence is needed.
 */

import type { InsightConfig } from "./insights";

const defaults: Required<InsightConfig> = {
  dailyRevenueTarget: 5000,
  monthlyRevenueTarget: 50000,
  lowStockThreshold: 5,
  overdueJobHours: 72,
};

let current: Required<InsightConfig> = { ...defaults };

export function getConfig(): Required<InsightConfig> {
  return { ...current };
}

export function updateConfig(patch: Partial<InsightConfig>): Required<InsightConfig> {
  current = { ...current, ...patch };
  return getConfig();
}

export function resetConfig(): Required<InsightConfig> {
  current = { ...defaults };
  return getConfig();
}
