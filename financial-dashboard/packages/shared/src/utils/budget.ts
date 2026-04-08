import Decimal from 'decimal.js';
import { sumArs } from './money.js';

/**
 * Return the number of calendar days in a given month.
 * month is 1-indexed (1 = January).
 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new Error(`Invalid month: ${month}`);
  return new Date(year, month, 0).getDate();
}

/**
 * Compute the planned daily ARS budget for a given month.
 * dailyBudget = monthlyIncomeArs / daysInMonth
 * Rounded to 2 decimal places (centavos level for display).
 */
export function computeDailyBudget(monthlyIncomeArs: number, year: number, month: number): number {
  if (monthlyIncomeArs < 0) {
    throw new Error('monthlyIncomeArs must be non-negative');
  }
  const days = daysInMonth(year, month);
  return new Decimal(monthlyIncomeArs).div(days).toDecimalPlaces(2).toNumber();
}

/**
 * Compute remaining daily budget after actual spending.
 * A negative result means the day is over budget.
 */
export function computeRemainingBudget(dailyBudgetArs: number, spentArs: number): number {
  return new Decimal(dailyBudgetArs).minus(new Decimal(spentArs)).toDecimalPlaces(2).toNumber();
}

/**
 * Compute total monthly commitment load in ARS given:
 * - an array of commitment amounts already converted to ARS
 * Useful for deriving "disposable" monthly income.
 */
export function computeDisposableIncome(
  monthlyIncomeArs: number,
  monthlyCommitmentsArs: number[],
): number {
  const totalCommitments = sumArs(monthlyCommitmentsArs);
  return new Decimal(monthlyIncomeArs).minus(totalCommitments).toDecimalPlaces(2).toNumber();
}
