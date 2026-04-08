import { useState, useEffect, useCallback } from 'react';
import { formatARS, fmtOriginal, formatDate, todayISO, toMonthLabel } from '../utils/format.js';
import { Modal, Spinner, ErrorBox, Label, inputCls } from '../components/ui/shared.js';

interface ExpenseCategory {
  id: string;
  name: string;
  color?: string;
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

interface RecurringCommitment {
  id: string;
  name: string;
  type: 'EXPENSE' | 'SUBSCRIPTION' | 'SERVICE' | 'OTHER';
  dayOfMonth: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  versions: Array<{ effectiveFrom: string; originalAmount: number; originalCurrency: string }>;
}

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'Expense',
  SUBSCRIPTION: 'Subscription',
  SERVICE: 'Service',
  OTHER: 'Other',
};
const TYPE_COLOR: Record<string, string> = {
  EXPENSE: 'bg-violet-50 text-violet-700',
  SUBSCRIPTION: 'bg-blue-50 text-blue-700',
  SERVICE: 'bg-cyan-50 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-500',
};

function latestVersion(c: RecurringCommitment) {
  if (c.versions.length === 0) return null;
  return [...c.versions].sort(
    (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
  )[0]!;
}

export function Expenses() {
  const now = new Date();
  const [tab, setTab] = useState<'entries' | 'commitments'>('entries');

  // Entries
  const [filterMonth, setFilterMonth] = useState(
    toMonthLabel(now.getFullYear(), now.getMonth() + 1),
  );
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Record expense form
  const [showRecord, setShowRecord] = useState(false);
  const [rForm, setRForm] = useState({
    entryDate: todayISO(),
    description: '',
    categoryId: '',
    originalAmount: '',
    originalCurrency: 'ARS',
    fxRate: '1',
    arsAmount: '',
  });
  const [rBusy, setRBusy] = useState(false);

  // Commitments
  const [commitments, setCommitments] = useState<RecurringCommitment[]>([]);
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState<string | null>(null);

  // Add commitment form
  const [showAdd, setShowAdd] = useState(false);
  const [aForm, setAForm] = useState({
    name: '',
    type: 'EXPENSE',
    dayOfMonth: '1',
    startDate: todayISO(),
    initialAmount: '',
    initialCurrency: 'ARS',
  });
  const [aBusy, setABusy] = useState(false);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    setEntriesError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/expenses/entries?month=${filterMonth}&limit=100`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load');
      setEntries(json.data);
    } catch (e) {
      setEntriesError((e as Error).message);
    } finally {
      setEntriesLoading(false);
    }
  }, [filterMonth]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/expenses/categories`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok) setCategories(json.data);
    } catch {
      // non-critical
    }
  }, []);

  const loadCommitments = useCallback(async () => {
    setCLoading(true);
    setCError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/commitments`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load');
      setCommitments(json.data);
    } catch (e) {
      setCError((e as Error).message);
    } finally {
      setCLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    loadCategories();
  }, [loadEntries, loadCategories]);

  useEffect(() => {
    if (tab === 'commitments') loadCommitments();
  }, [tab, loadCommitments]);

  function setRField(field: string, value: string) {
    setRForm((prev) => {
      const next = { ...prev, [field]: value };
      const cur = field === 'originalCurrency' ? value : next.originalCurrency;
      if (cur === 'ARS') {
        next.fxRate = '1';
        if (field === 'originalAmount') next.arsAmount = value;
      } else {
        const amt = parseFloat(field === 'originalAmount' ? value : next.originalAmount);
        const rate = parseFloat(field === 'fxRate' ? value : next.fxRate);
        if (!isNaN(amt) && !isNaN(rate) && rate > 0) {
          next.arsAmount = (Math.round(amt * rate * 100) / 100).toString();
        }
      }
      return next;
    });
  }

  async function submitRecord(e: { preventDefault(): void }) {
    e.preventDefault();
    setRBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/expenses/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: rForm.entryDate,
          ...(rForm.description ? { description: rForm.description } : {}),
          ...(rForm.categoryId ? { categoryId: rForm.categoryId } : {}),
          originalAmount: parseFloat(rForm.originalAmount),
          originalCurrency: rForm.originalCurrency,
          fxRate: parseFloat(rForm.fxRate),
          arsAmount: parseFloat(rForm.arsAmount || rForm.originalAmount),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to record');
      setShowRecord(false);
      setRForm({
        entryDate: todayISO(),
        description: '',
        categoryId: '',
        originalAmount: '',
        originalCurrency: 'ARS',
        fxRate: '1',
        arsAmount: '',
      });
      loadEntries();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRBusy(false);
    }
  }

  async function submitAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    setABusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/commitments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: aForm.name,
          type: aForm.type,
          dayOfMonth: parseInt(aForm.dayOfMonth),
          startDate: aForm.startDate,
          initialAmount: parseFloat(aForm.initialAmount),
          initialCurrency: aForm.initialCurrency,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to add');
      setShowAdd(false);
      setAForm({
        name: '',
        type: 'EXPENSE',
        dayOfMonth: '1',
        startDate: todayISO(),
        initialAmount: '',
        initialCurrency: 'ARS',
      });
      loadCommitments();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setABusy(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this commitment?')) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/commitments/${id}/deactivate`,
        { method: 'PATCH', credentials: 'include' },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed');
      loadCommitments();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Expenses</h1>
        {tab === 'entries' ? (
          <button
            onClick={() => setShowRecord(true)}
            className="px-3.5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Record
          </button>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Add Commitment
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['entries', 'commitments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t === 'entries' ? 'Entries' : 'Commitments'}
          </button>
        ))}
      </div>

      {/* ENTRIES TAB */}
      {tab === 'entries' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Month</span>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>

          {entriesLoading && <Spinner />}
          {entriesError && <ErrorBox message={entriesError} onRetry={loadEntries} />}

          {!entriesLoading && !entriesError && entries.length === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <div className="w-12 h-12 mb-3 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400">
                $
              </div>
              <div className="text-sm text-gray-500">No expense entries for this month</div>
              <button
                onClick={() => setShowRecord(true)}
                className="mt-2 text-sm text-gray-600 underline"
              >
                Record the first one
              </button>
            </div>
          )}

          {!entriesLoading && !entriesError && entries.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Date', 'Description', 'Category', 'Amount', 'Source'].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest ${h === 'Amount' ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-50 last:border-0 hover:bg-blue-50/20 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 tabular-nums whitespace-nowrap">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
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
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${entry.source === 'MANUAL' ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-600'}`}
                        >
                          {entry.source === 'MANUAL' ? 'Manual' : 'Import'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COMMITMENTS TAB */}
      {tab === 'commitments' && (
        <div className="space-y-2.5">
          {cLoading && <Spinner />}
          {cError && <ErrorBox message={cError} onRetry={loadCommitments} />}

          {!cLoading && !cError && commitments.length === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm text-gray-500">No recurring commitments yet</div>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-2 text-sm text-gray-600 underline"
              >
                Add the first one
              </button>
            </div>
          )}

          {!cLoading &&
            !cError &&
            commitments.map((c) => {
              const v = latestVersion(c);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 ${!c.isActive ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 truncate">{c.name}</span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLOR[c.type]}`}
                      >
                        {TYPE_LABEL[c.type]}
                      </span>
                      {!c.isActive && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                      <span>Day {c.dayOfMonth}/month</span>
                      {v && (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {v.originalAmount.toLocaleString('es-AR')} {v.originalCurrency}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {c.isActive && (
                    <button
                      onClick={() => deactivate(c.id)}
                      className="shrink-0 text-xs text-gray-400 hover:text-rose-600 font-medium transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Record Expense Modal */}
      {showRecord && (
        <Modal title="Record Expense" onClose={() => setShowRecord(false)}>
          <form onSubmit={submitRecord} className="space-y-3.5">
            <div>
              <Label>Date</Label>
              <input
                type="date"
                required
                value={rForm.entryDate}
                onChange={(e) => setRField('entryDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <Label>
                Description{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <input
                type="text"
                value={rForm.description}
                onChange={(e) => setRField('description', e.target.value)}
                className={inputCls}
                placeholder="What was this for?"
              />
            </div>
            <div>
              <Label>
                Category <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <select
                value={rForm.categoryId}
                onChange={(e) => setRField('categoryId', e.target.value)}
                className={inputCls}
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <Label>Amount</Label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={rForm.originalAmount}
                  onChange={(e) => setRField('originalAmount', e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label>Currency</Label>
                <select
                  value={rForm.originalCurrency}
                  onChange={(e) => setRField('originalCurrency', e.target.value)}
                  className={inputCls}
                >
                  <option>ARS</option>
                  <option>USD</option>
                  <option>USDT</option>
                </select>
              </div>
            </div>
            {rForm.originalCurrency !== 'ARS' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>FX Rate (→ ARS)</Label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={rForm.fxRate}
                    onChange={(e) => setRField('fxRate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>ARS Amount</Label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={rForm.arsAmount}
                    onChange={(e) => setRForm((p) => ({ ...p, arsAmount: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={rBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {rBusy ? 'Recording…' : 'Record'}
              </button>
              <button
                type="button"
                onClick={() => setShowRecord(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Commitment Modal */}
      {showAdd && (
        <Modal title="Add Recurring Commitment" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd} className="space-y-3.5">
            <div>
              <Label>Name</Label>
              <input
                type="text"
                required
                value={aForm.name}
                onChange={(e) => setAForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Netflix, Rent"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <select
                  value={aForm.type}
                  onChange={(e) => setAForm((p) => ({ ...p, type: e.target.value }))}
                  className={inputCls}
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="SERVICE">Service</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <Label>Day of month</Label>
                <input
                  type="number"
                  required
                  min="1"
                  max="31"
                  value={aForm.dayOfMonth}
                  onChange={(e) => setAForm((p) => ({ ...p, dayOfMonth: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <Label>Start Date</Label>
              <input
                type="date"
                required
                value={aForm.startDate}
                onChange={(e) => setAForm((p) => ({ ...p, startDate: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <Label>Initial Amount</Label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={aForm.initialAmount}
                  onChange={(e) => setAForm((p) => ({ ...p, initialAmount: e.target.value }))}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label>Currency</Label>
                <select
                  value={aForm.initialCurrency}
                  onChange={(e) => setAForm((p) => ({ ...p, initialCurrency: e.target.value }))}
                  className={inputCls}
                >
                  <option>ARS</option>
                  <option>USD</option>
                  <option>USDT</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={aBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {aBusy ? 'Adding…' : 'Add Commitment'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
