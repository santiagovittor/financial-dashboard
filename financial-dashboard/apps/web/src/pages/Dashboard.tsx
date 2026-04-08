import { useState, useEffect, useCallback } from 'react';
import { formatARS, toMonthLabel } from '../utils/format.js';
import { Spinner, ErrorBox } from '../components/ui/shared.js';

interface MonthlySummary {
  year: number;
  month: number;
  monthLabel: string;
  daysInMonth: number;
  remainingDays: number;
  isCurrentMonth: boolean;
  income: { plannedArs: number | null; actualArs: number; varianceArs: number | null };
  expenses: { totalArs: number; entryCount: number };
  commitments: { totalArs: number; count: number; hasMissingRates: boolean };
  debts: { paymentsTotalArs: number; paymentCount: number };
  balance: {
    totalOutflowArs: number;
    referenceIncomeArs: number;
    remainingArs: number;
    dailyAvailableArs: number | null;
    isOverBudget: boolean;
  };
  risk: { dailySpend: 'OK' | 'WARNING' | 'DANGER'; debtBurden: 'OK' | 'WARNING' | 'DANGER' };
}

type RiskLevel = 'OK' | 'WARNING' | 'DANGER';

const RISK_PILL: Record<RiskLevel, string> = {
  OK: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  WARNING: 'bg-amber-50 text-amber-700 border border-amber-200',
  DANGER: 'bg-rose-50 text-rose-700 border border-rose-200',
};
const RISK_DOT: Record<RiskLevel, string> = {
  OK: 'bg-emerald-500',
  WARNING: 'bg-amber-400',
  DANGER: 'bg-rose-500',
};

function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${RISK_PILL[level]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[level]}`} />
        {level}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {label}
      </div>
      <div className="font-mono text-xl font-bold text-gray-900 tabular-nums leading-tight">
        {value}
      </div>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

export function Dashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ml = toMonthLabel(year, month);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/budget/summary?month=${ml}`,
        { credentials: 'include' },
      );
      const json = (await res.json()) as { ok: boolean; data: MonthlySummary; message?: string };
      if (!json.ok) throw new Error(json.message ?? 'Failed to load summary');
      setData(json.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors text-lg"
        >
          ‹
        </button>
        <div className="font-mono text-sm font-semibold text-gray-900 tabular-nums w-20 text-center">
          {toMonthLabel(year, month)}
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {loading && <Spinner />}
      {error && !loading && <ErrorBox message={error} onRetry={loadSummary} />}

      {data && !loading && (
        <div className="space-y-4">
          {data.commitments.hasMissingRates && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <span className="text-amber-500 shrink-0">▲</span>
              Some commitments have missing FX rates — totals may be understated.
            </div>
          )}

          {/* 4 Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Income"
              value={formatARS(data.income.actualArs)}
              sub={
                data.income.plannedArs !== null ? (
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-gray-400">
                      of {formatARS(data.income.plannedArs)} planned
                    </div>
                    {data.income.varianceArs !== null && (
                      <div
                        className={`font-mono text-[11px] tabular-nums ${data.income.varianceArs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {data.income.varianceArs >= 0 ? '+' : ''}
                        {formatARS(data.income.varianceArs)}
                      </div>
                    )}
                  </div>
                ) : undefined
              }
            />
            <StatCard
              label="Expenses"
              value={formatARS(data.expenses.totalArs)}
              sub={
                <span className="text-[11px] text-gray-400">
                  {data.expenses.entryCount} entries
                </span>
              }
            />
            <StatCard
              label="Commitments"
              value={formatARS(data.commitments.totalArs)}
              sub={
                <span className="text-[11px] text-gray-400">{data.commitments.count} active</span>
              }
            />
            <StatCard
              label="Debt Payments"
              value={formatARS(data.debts.paymentsTotalArs)}
              sub={
                <span className="text-[11px] text-gray-400">
                  {data.debts.paymentCount} payments
                </span>
              }
            />
          </div>

          {/* Hero + Risk row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Daily Available hero */}
            <div
              className={`col-span-2 rounded-xl border p-6 ${
                data.balance.isOverBudget
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <div
                className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${
                  data.balance.isOverBudget ? 'text-rose-400' : 'text-emerald-500'
                }`}
              >
                Daily Available
              </div>
              <div
                className={`font-mono text-5xl font-bold tabular-nums leading-none ${
                  data.balance.isOverBudget ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {data.balance.dailyAvailableArs !== null
                  ? formatARS(data.balance.dailyAvailableArs)
                  : '—'}
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium">{data.remainingDays} days remaining</span>
                <span className="text-gray-300">·</span>
                <span>
                  Balance:{' '}
                  <span
                    className={`font-mono tabular-nums ${
                      data.balance.isOverBudget ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatARS(data.balance.remainingArs)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 text-xs text-gray-400">
                Outflow {formatARS(data.balance.totalOutflowArs)} · Ref. income{' '}
                {formatARS(data.balance.referenceIncomeArs)}
              </div>
            </div>

            {/* Risk panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Risk Indicators
              </div>
              <div className="space-y-4">
                <RiskBadge level={data.risk.dailySpend} label="Daily Spend Pace" />
                <RiskBadge level={data.risk.debtBurden} label="Debt Burden" />
              </div>
              <div className="mt-auto pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                Day {data.daysInMonth - data.remainingDays} of {data.daysInMonth}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
