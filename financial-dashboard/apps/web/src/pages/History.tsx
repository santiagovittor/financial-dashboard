import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { formatARS, fmtOriginal, formatDate, toMonthLabel } from '../utils/format.js';
import { Spinner, ErrorBox } from '../components/ui/shared.js';

interface IncomeEntry {
  id: string;
  entryDate: string;
  description?: string;
  originalAmount: number;
  originalCurrency: string;
  arsAmount: number;
  source: 'MANUAL' | 'DOCUMENT_IMPORT';
}

interface ExpenseEntry {
  id: string;
  entryDate: string;
  description?: string;
  originalAmount: number;
  originalCurrency: string;
  arsAmount: number;
  category?: { name: string; color?: string };
  source: 'MANUAL' | 'DOCUMENT_IMPORT';
}

function sumArs(items: { arsAmount: number }[]) {
  return items.reduce((acc, e) => acc + e.arsAmount, 0);
}

function SourceBadge({ source }: { source: 'MANUAL' | 'DOCUMENT_IMPORT' }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${source === 'MANUAL' ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-600'}`}
    >
      {source === 'MANUAL' ? 'Manual' : 'Import'}
    </span>
  );
}

const TH = 'px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-left';
const TH_RIGHT = 'px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-right';

export function History() {
  const now = new Date();
  const [month, setMonth] = useState(toMonthLabel(now.getFullYear(), now.getMonth() + 1));

  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  const loadIncome = useCallback(async () => {
    setIncomeLoading(true);
    setIncomeError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/income/entries?month=${month}&limit=200`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load income');
      setIncome(json.data);
    } catch (e) {
      setIncomeError((e as Error).message);
    } finally {
      setIncomeLoading(false);
    }
  }, [month]);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    setExpensesError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/expenses/entries?month=${month}&limit=200`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load expenses');
      setExpenses(json.data);
    } catch (e) {
      setExpensesError((e as Error).message);
    } finally {
      setExpensesLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadIncome();
    loadExpenses();
  }, [loadIncome, loadExpenses]);

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">History</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
      </div>

      {/* Income section */}
      <section>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
          Income Entries
        </div>
        {incomeLoading && <Spinner />}
        {incomeError && <ErrorBox message={incomeError} onRetry={loadIncome} />}
        {!incomeLoading && !incomeError && (
          income.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No income entries for {month}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={TH}>Date</th>
                    <th className={TH}>Description</th>
                    <th className={TH_RIGHT}>Amount</th>
                    <th className={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {income.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 tabular-nums whitespace-nowrap">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {entry.description ?? (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono tabular-nums text-emerald-700">
                          {formatARS(entry.arsAmount)}
                        </div>
                        {entry.originalCurrency !== 'ARS' && (
                          <div className="font-mono text-[11px] text-gray-400 tabular-nums">
                            {fmtOriginal(entry.originalAmount, entry.originalCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={entry.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-500">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sm font-bold text-emerald-700">
                      {formatARS(sumArs(income))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </section>

      {/* Expenses section */}
      <section>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
          Expense Entries
        </div>
        {expensesLoading && <Spinner />}
        {expensesError && <ErrorBox message={expensesError} onRetry={loadExpenses} />}
        {!expensesLoading && !expensesError && (
          expenses.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No expense entries for {month}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={TH}>Date</th>
                    <th className={TH}>Description</th>
                    <th className={TH}>Category</th>
                    <th className={TH_RIGHT}>Amount</th>
                    <th className={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 tabular-nums whitespace-nowrap">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {entry.description ?? (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.category ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: entry.category.color
                                ? `${entry.category.color}22`
                                : '#f3f4f6',
                              color: entry.category.color ?? '#6b7280',
                            }}
                          >
                            {entry.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono tabular-nums text-gray-900">
                          {formatARS(entry.arsAmount)}
                        </div>
                        {entry.originalCurrency !== 'ARS' && (
                          <div className="font-mono text-[11px] text-gray-400 tabular-nums">
                            {fmtOriginal(entry.originalAmount, entry.originalCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={entry.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-500">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sm font-bold text-gray-900">
                      {formatARS(sumArs(expenses))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </section>

      {/* Debt Payments section */}
      <section>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
          Debt Payments
        </div>
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
          <div className="text-sm text-gray-400 mb-1">
            Debt payment history is available from the
          </div>
          <Link
            to="/debts"
            className="text-sm text-gray-700 font-medium underline hover:text-gray-900 transition-colors"
          >
            Debts page
          </Link>
        </div>
      </section>
    </div>
  );
}
