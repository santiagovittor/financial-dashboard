import { useState, useEffect, useCallback } from 'react';
import { formatARS, formatDate } from '../utils/format.js';
import { Spinner, ErrorBox } from '../components/ui/shared.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'OK' | 'WARNING' | 'DANGER';

interface DashboardData {
  coversPeriod: string;
  summary: {
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
    risk: { dailySpend: RiskLevel; debtBurden: RiskLevel };
    remainingDays: number;
  };
  categoryBreakdown: Array<{ category: string; totalArs: number }>;
  currencySplit: { arsExpensesArs: number; usdExpensesArs: number };
  recentMonthsTrend: Array<{ month: string; expensesArs: number; incomeArs: number }>;
  activeDebts: Array<{
    name: string;
    type: string;
    balanceOriginal: number;
    balanceCurrency: string;
    interestRateAnnual: number | null;
    monthlyInstallmentOriginal: number | null;
    installmentCurrency: string | null;
    dueDate: string | null;
  }>;
}

interface NarrativeSections {
  overview: string;
  spendingDrivers: string;
  debtPressure: string;
  cuttableSpend: string;
  watchThis: string;
  dailyBudgetAssessment: string;
}

interface StoredAnalysis {
  id: string;
  coversPeriod: string;
  generatedAt: string;
  dataUpdatedAt: string;
  sections: NarrativeSections;
  isStale: boolean;
  latestDataUpdatedAt: string;
}

// ─── Small components ─────────────────────────────────────────────────────────

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

function RiskPill({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_PILL[level]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[level]}`} />
      {level}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </div>
  );
}

function MetricRow({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'neutral';
}) {
  const valCls =
    accent === 'green'
      ? 'text-emerald-700'
      : accent === 'red'
        ? 'text-rose-700'
        : 'text-gray-900';
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-right">
        <span className={`font-mono text-sm font-semibold tabular-nums ${valCls}`}>{value}</span>
        {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

// Category bar chart — pure CSS, no library
function CategoryBar({
  category,
  totalArs,
  maxArs,
}: {
  category: string;
  totalArs: number;
  maxArs: number;
}) {
  const pct = maxArs > 0 ? (totalArs / maxArs) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 text-xs text-gray-500 truncate capitalize">{category}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-700 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-28 text-right font-mono text-xs text-gray-700 tabular-nums shrink-0">
        {formatARS(totalArs)}
      </div>
    </div>
  );
}

// Trend mini-bar chart
function TrendBar({
  month,
  expensesArs,
  incomeArs,
  maxArs,
}: {
  month: string;
  expensesArs: number;
  incomeArs: number;
  maxArs: number;
}) {
  const expPct = maxArs > 0 ? (expensesArs / maxArs) * 100 : 0;
  const incPct = maxArs > 0 ? (incomeArs / maxArs) * 100 : 0;
  const shortMonth = month.slice(5); // MM
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-10 h-16 flex flex-col justify-end gap-0.5">
        {incomeArs > 0 && (
          <div
            className="w-full bg-emerald-200 rounded-sm transition-all duration-500"
            style={{ height: `${incPct}%` }}
            title={`Income ${formatARS(incomeArs)}`}
          />
        )}
        {expensesArs > 0 && (
          <div
            className="w-full bg-gray-300 rounded-sm transition-all duration-500"
            style={{ height: `${expPct}%` }}
            title={`Expenses ${formatARS(expensesArs)}`}
          />
        )}
      </div>
      <span className="text-[10px] text-gray-400 font-mono">{shortMonth}</span>
    </div>
  );
}

// Narrative section card
const NARRATIVE_ACCENT: Record<keyof NarrativeSections, string> = {
  overview: 'border-l-gray-900',
  spendingDrivers: 'border-l-blue-500',
  debtPressure: 'border-l-rose-500',
  cuttableSpend: 'border-l-amber-400',
  watchThis: 'border-l-violet-500',
  dailyBudgetAssessment: 'border-l-emerald-500',
};
const NARRATIVE_LABEL: Record<keyof NarrativeSections, string> = {
  overview: 'Overview',
  spendingDrivers: 'Spending drivers',
  debtPressure: 'Debt pressure',
  cuttableSpend: 'Where to cut',
  watchThis: 'Watch this month',
  dailyBudgetAssessment: 'Daily budget',
};

function NarrativeCard({
  sectionKey,
  text,
}: {
  sectionKey: keyof NarrativeSections;
  text: string;
}) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl border-l-4 ${NARRATIVE_ACCENT[sectionKey]} pl-4 pr-5 py-4`}
    >
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
        {NARRATIVE_LABEL[sectionKey]}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

const NARRATIVE_KEYS: (keyof NarrativeSections)[] = [
  'overview',
  'spendingDrivers',
  'debtPressure',
  'cuttableSpend',
  'watchThis',
  'dailyBudgetAssessment',
];

// ─── Main page ────────────────────────────────────────────────────────────────

export function Analysis() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState<string | null>(null);

  const [narrative, setNarrative] = useState<StoredAnalysis | null>(null);
  const [narLoading, setNarLoading] = useState(true);
  const [narError, setNarError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const API = import.meta.env.VITE_API_URL as string;

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      const res = await fetch(`${API}/api/v1/analysis/dashboard`, { credentials: 'include' });
      const json = (await res.json()) as { ok: boolean; data: DashboardData; message?: string };
      if (!json.ok) throw new Error(json.message ?? 'Failed to load dashboard data');
      setDashboard(json.data);
    } catch (e) {
      setDashError((e as Error).message);
    } finally {
      setDashLoading(false);
    }
  }, [API]);

  const loadNarrative = useCallback(async () => {
    setNarLoading(true);
    setNarError(null);
    try {
      const res = await fetch(`${API}/api/v1/analysis`, { credentials: 'include' });
      if (res.status === 204) {
        setNarrative(null);
      } else {
        const json = (await res.json()) as { ok: boolean; data: StoredAnalysis; message?: string };
        if (!json.ok) throw new Error(json.message ?? 'Failed to load narrative');
        setNarrative(json.data);
      }
    } catch (e) {
      setNarError((e as Error).message);
    } finally {
      setNarLoading(false);
    }
  }, [API]);

  useEffect(() => {
    loadDashboard();
    loadNarrative();
  }, [loadDashboard, loadNarrative]);

  async function handleGenerate() {
    setGenerating(true);
    setNarError(null);
    try {
      const res = await fetch(`${API}/api/v1/analysis/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { ok: boolean; data: StoredAnalysis; message?: string };
      if (!json.ok) throw new Error(json.message ?? 'Generation failed');
      setNarrative(json.data);
    } catch (e) {
      setNarError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  // Derived values
  const maxCategoryArs =
    dashboard?.categoryBreakdown.length ? dashboard.categoryBreakdown[0]!.totalArs : 0;

  const maxTrendArs =
    dashboard?.recentMonthsTrend.length
      ? Math.max(...dashboard.recentMonthsTrend.flatMap((m) => [m.expensesArs, m.incomeArs]))
      : 0;

  const totalExpenses =
    dashboard ? dashboard.currencySplit.arsExpensesArs + dashboard.currencySplit.usdExpensesArs : 0;
  const arsPct = totalExpenses > 0 ? (dashboard!.currencySplit.arsExpensesArs / totalExpenses) * 100 : 0;
  const usdPct = totalExpenses > 0 ? (dashboard!.currencySplit.usdExpensesArs / totalExpenses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Insights</h1>
          {dashboard && (
            <p className="text-xs text-gray-400 mt-0.5">
              Analysing {dashboard.coversPeriod} · updated automatically
            </p>
          )}
        </div>
      </div>

      {/* ── DETERMINISTIC LAYER ─────────────────────────────────────────────── */}
      {dashLoading && <Spinner />}
      {dashError && !dashLoading && <ErrorBox message={dashError} onRetry={loadDashboard} />}

      {dashboard && !dashLoading && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Income vs plan */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionLabel>Income</SectionLabel>
              <div className="font-mono text-lg font-bold text-gray-900 tabular-nums">
                {formatARS(dashboard.summary.income.actualArs)}
              </div>
              {dashboard.summary.income.plannedArs !== null && (
                <div className="mt-1 text-[11px] text-gray-400">
                  of {formatARS(dashboard.summary.income.plannedArs)} planned
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionLabel>Expenses</SectionLabel>
              <div className="font-mono text-lg font-bold text-gray-900 tabular-nums">
                {formatARS(dashboard.summary.expenses.totalArs)}
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                {dashboard.summary.expenses.entryCount} entries
              </div>
            </div>

            {/* Daily available */}
            <div
              className={`rounded-xl p-4 border ${
                dashboard.summary.balance.isOverBudget
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <SectionLabel>Daily available</SectionLabel>
              <div
                className={`font-mono text-lg font-bold tabular-nums ${
                  dashboard.summary.balance.isOverBudget ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {dashboard.summary.balance.dailyAvailableArs !== null
                  ? formatARS(dashboard.summary.balance.dailyAvailableArs)
                  : '—'}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {dashboard.summary.remainingDays} days left
              </div>
            </div>

            {/* Risk */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionLabel>Risk</SectionLabel>
              <div className="space-y-2 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Spend</span>
                  <RiskPill level={dashboard.summary.risk.dailySpend} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Debt</span>
                  <RiskPill level={dashboard.summary.risk.debtBurden} />
                </div>
              </div>
            </div>
          </div>

          {/* Detail row: categories + currency + trend + debts */}
          <div className="grid grid-cols-12 gap-3">
            {/* Category breakdown — 5 cols */}
            <div className="col-span-12 sm:col-span-5 bg-white border border-gray-200 rounded-xl p-5">
              <SectionLabel>Spending by category</SectionLabel>
              {dashboard.categoryBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400">No expense entries this month.</p>
              ) : (
                <div className="space-y-0.5">
                  {dashboard.categoryBreakdown.slice(0, 8).map((c) => (
                    <CategoryBar
                      key={c.category}
                      category={c.category}
                      totalArs={c.totalArs}
                      maxArs={maxCategoryArs}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right column: currency split + trend + debts — 7 cols */}
            <div className="col-span-12 sm:col-span-7 space-y-3">
              {/* Currency split */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <SectionLabel>Currency exposure</SectionLabel>
                <div className="space-y-0">
                  <MetricRow
                    label="ARS expenses"
                    value={formatARS(dashboard.currencySplit.arsExpensesArs)}
                    sub={`${arsPct.toFixed(0)}% of total`}
                  />
                  <MetricRow
                    label="USD expenses (in ARS)"
                    value={formatARS(dashboard.currencySplit.usdExpensesArs)}
                    sub={`${usdPct.toFixed(0)}% of total`}
                  />
                  <MetricRow
                    label="Commitments"
                    value={formatARS(dashboard.summary.commitments.totalArs)}
                    sub={`${dashboard.summary.commitments.count} active`}
                  />
                  <MetricRow
                    label="Debt payments"
                    value={formatARS(dashboard.summary.debts.paymentsTotalArs)}
                  />
                </div>
              </div>

              {/* Trend + debts side by side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Recent trend */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <SectionLabel>Recent trend</SectionLabel>
                  {dashboard.recentMonthsTrend.length === 0 ? (
                    <p className="text-xs text-gray-400">No prior month data.</p>
                  ) : (
                    <div className="flex items-end gap-2 mt-2">
                      {dashboard.recentMonthsTrend.map((m) => (
                        <TrendBar
                          key={m.month}
                          month={m.month}
                          expensesArs={m.expensesArs}
                          incomeArs={m.incomeArs}
                          maxArs={maxTrendArs}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />
                      <span className="text-[10px] text-gray-400">Income</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-gray-300 inline-block" />
                      <span className="text-[10px] text-gray-400">Expenses</span>
                    </div>
                  </div>
                </div>

                {/* Active debts */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <SectionLabel>Active debts</SectionLabel>
                  {dashboard.activeDebts.length === 0 ? (
                    <p className="text-xs text-gray-400">No active debts.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {dashboard.activeDebts.slice(0, 4).map((d, i) => (
                        <div key={i} className="text-sm">
                          <div className="font-medium text-gray-800 truncate text-xs">{d.name}</div>
                          <div className="font-mono text-xs text-gray-500 tabular-nums">
                            {d.balanceOriginal.toLocaleString('es-AR')} {d.balanceCurrency}
                            {d.interestRateAnnual !== null && (
                              <span className="text-rose-500 ml-1">
                                {(d.interestRateAnnual * 100).toFixed(0)}% p.a.
                              </span>
                            )}
                          </div>
                          {d.monthlyInstallmentOriginal !== null && (
                            <div className="text-[10px] text-gray-400">
                              {d.monthlyInstallmentOriginal.toLocaleString('es-AR')}{' '}
                              {d.installmentCurrency} / mo
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NARRATIVE LAYER ──────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-gray-100">
        {/* Narrative header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
              AI narrative analysis
            </div>
            {narrative && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Generated {formatDate(narrative.generatedAt)}</span>
                {narrative.isStale && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Data changed
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {narError && !generating && (
              <span className="text-xs text-rose-600">{narError}</span>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Generating…
                </span>
              ) : narrative ? (
                'Refresh analysis'
              ) : (
                'Generate analysis'
              )}
            </button>
          </div>
        </div>

        {narLoading && !narrative && <Spinner />}

        {!narLoading && !narrative && !narError && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-400 text-lg">
              ◇
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">No analysis yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Click "Generate analysis" to get an AI-written explanation of your spending patterns,
              debt pressure, and daily budget health.
            </p>
          </div>
        )}

        {narrative && !narLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NARRATIVE_KEYS.map((key) => (
              <NarrativeCard key={key} sectionKey={key} text={narrative.sections[key]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
