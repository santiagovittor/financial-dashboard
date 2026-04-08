export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER';

export interface RiskThreshold {
  warning: number; // ratio at which warning state begins (inclusive)
  danger: number; // ratio at which danger state begins (inclusive)
}

/**
 * Evaluate a ratio against warning/danger thresholds.
 *
 * @param actual  - the actual ratio (e.g. spentArs / dailyBudgetArs)
 * @param threshold - the configured thresholds
 * @returns the risk level
 */
export function evaluateRiskLevel(actual: number, threshold: RiskThreshold): RiskLevel {
  if (threshold.warning >= threshold.danger) {
    throw new Error('warning threshold must be less than danger threshold');
  }
  if (actual >= threshold.danger) return 'DANGER';
  if (actual >= threshold.warning) return 'WARNING';
  return 'SAFE';
}

/**
 * Build a RiskThreshold from stored risk setting values.
 * Convenience wrapper used when reading from the database.
 */
export function buildThreshold(warning: number, danger: number): RiskThreshold {
  if (warning <= 0 || danger <= 0) {
    throw new Error('Threshold values must be positive');
  }
  if (warning >= danger) {
    throw new Error('warning must be less than danger');
  }
  return { warning, danger };
}

/**
 * Evaluate daily spend risk given ARS amounts.
 */
export function evaluateDailySpend(
  spentArs: number,
  dailyBudgetArs: number,
  threshold: RiskThreshold,
): RiskLevel {
  if (dailyBudgetArs <= 0) return 'SAFE'; // no budget configured — don't alarm
  return evaluateRiskLevel(spentArs / dailyBudgetArs, threshold);
}

/**
 * Evaluate debt burden risk given monthly amounts.
 */
export function evaluateDebtBurden(
  monthlyDebtPaymentsArs: number,
  monthlyIncomeArs: number,
  threshold: RiskThreshold,
): RiskLevel {
  if (monthlyIncomeArs <= 0) return 'SAFE';
  return evaluateRiskLevel(monthlyDebtPaymentsArs / monthlyIncomeArs, threshold);
}
