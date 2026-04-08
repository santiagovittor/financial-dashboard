import { useState, useEffect, useCallback } from 'react';
import { formatARS, fmtOriginal, formatDate, todayISO } from '../utils/format.js';
import { Modal, Spinner, ErrorBox, Label, inputCls } from '../components/ui/shared.js';

interface Debt {
  id: string;
  name: string;
  type: 'FIXED_INSTALLMENT' | 'REVOLVING';
  status: 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
  originalPrincipal: number;
  principalCurrency: string;
  fxRate: number;
  arsPrincipal: number;
  currentBalanceOriginal: number;
  currentBalanceCurrency: string;
  openedAt: string;
  dueDate?: string;
  interestRateAnnual?: number;
  installmentCount?: number;
  installmentAmount?: number;
  installmentCurrency?: string;
  creditLimitOriginal?: number;
  notes?: string;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PAID_OFF: 'bg-gray-100 text-gray-500 border border-gray-200',
  CANCELLED: 'bg-rose-50 text-rose-600 border border-rose-200',
};
const TYPE_BADGE: Record<string, string> = {
  FIXED_INSTALLMENT: 'bg-violet-50 text-violet-700',
  REVOLVING: 'bg-blue-50 text-blue-700',
};
const TYPE_LABEL: Record<string, string> = {
  FIXED_INSTALLMENT: 'Fixed',
  REVOLVING: 'Revolving',
};
const STATUS_ORDER = ['ACTIVE', 'PAID_OFF', 'CANCELLED'];

function debtComputeArs(principal: string, rate: string): string {
  const p = parseFloat(principal);
  const r = parseFloat(rate);
  if (!isNaN(p) && !isNaN(r) && r > 0) {
    return (Math.round(p * r * 100) / 100).toString();
  }
  return '';
}

export function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Debt form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    type: 'FIXED_INSTALLMENT',
    originalPrincipal: '',
    principalCurrency: 'ARS',
    fxRate: '1',
    arsPrincipal: '',
    openedAt: todayISO(),
    dueDate: '',
    interestRateAnnual: '',
    installmentCount: '',
    installmentAmount: '',
    installmentCurrency: 'ARS',
    creditLimitOriginal: '',
  });
  const [addBusy, setAddBusy] = useState(false);

  // Record Payment
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payForm, setPayForm] = useState({
    paymentDate: todayISO(),
    originalAmount: '',
    originalCurrency: 'ARS',
    fxRate: '1',
    arsAmount: '',
    isMinimumPayment: false,
    notes: '',
  });
  const [payBusy, setPayBusy] = useState(false);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/debts`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load');
      setDebts(json.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  function setAddField(field: string, value: string) {
    setAddForm((prev) => {
      const next = { ...prev, [field]: value };
      const cur = field === 'principalCurrency' ? value : next.principalCurrency;
      if (cur === 'ARS') {
        next.fxRate = '1';
        if (field === 'originalPrincipal') next.arsPrincipal = value;
      } else {
        const computed = debtComputeArs(
          field === 'originalPrincipal' ? value : next.originalPrincipal,
          field === 'fxRate' ? value : next.fxRate,
        );
        if (computed) next.arsPrincipal = computed;
      }
      return next;
    });
  }

  function setPayField(field: string, value: string) {
    setPayForm((prev) => {
      const next = { ...prev, [field]: value };
      const cur = field === 'originalCurrency' ? value : next.originalCurrency;
      if (cur === 'ARS') {
        next.fxRate = '1';
        if (field === 'originalAmount') next.arsAmount = value;
      } else {
        const computed = debtComputeArs(
          field === 'originalAmount' ? value : next.originalAmount,
          field === 'fxRate' ? value : next.fxRate,
        );
        if (computed) next.arsAmount = computed;
      }
      return next;
    });
  }

  async function submitAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    setAddBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: addForm.name,
        type: addForm.type,
        originalPrincipal: parseFloat(addForm.originalPrincipal),
        principalCurrency: addForm.principalCurrency,
        fxRate: parseFloat(addForm.fxRate),
        arsPrincipal: parseFloat(addForm.arsPrincipal || addForm.originalPrincipal),
        openedAt: addForm.openedAt,
      };
      if (addForm.dueDate) body.dueDate = addForm.dueDate;
      if (addForm.interestRateAnnual)
        body.interestRateAnnual = parseFloat(addForm.interestRateAnnual);
      if (addForm.type === 'FIXED_INSTALLMENT') {
        body.installmentCount = parseInt(addForm.installmentCount);
        body.installmentAmount = parseFloat(addForm.installmentAmount);
        body.installmentCurrency = addForm.installmentCurrency;
      }
      if (addForm.type === 'REVOLVING') {
        body.creditLimitOriginal = parseFloat(addForm.creditLimitOriginal);
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/debts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to add debt');
      setShowAdd(false);
      setAddForm({
        name: '',
        type: 'FIXED_INSTALLMENT',
        originalPrincipal: '',
        principalCurrency: 'ARS',
        fxRate: '1',
        arsPrincipal: '',
        openedAt: todayISO(),
        dueDate: '',
        interestRateAnnual: '',
        installmentCount: '',
        installmentAmount: '',
        installmentCurrency: 'ARS',
        creditLimitOriginal: '',
      });
      loadDebts();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function submitPayment(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!payingDebt) return;
    setPayBusy(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/debts/${payingDebt.id}/payments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentDate: payForm.paymentDate,
            originalAmount: parseFloat(payForm.originalAmount),
            originalCurrency: payForm.originalCurrency,
            fxRate: parseFloat(payForm.fxRate),
            arsAmount: parseFloat(payForm.arsAmount || payForm.originalAmount),
            isMinimumPayment: payForm.isMinimumPayment,
            ...(payForm.notes ? { notes: payForm.notes } : {}),
          }),
        },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to record payment');
      setPayingDebt(null);
      setPayForm({
        paymentDate: todayISO(),
        originalAmount: '',
        originalCurrency: 'ARS',
        fxRate: '1',
        arsAmount: '',
        isMinimumPayment: false,
        notes: '',
      });
      loadDebts();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPayBusy(false);
    }
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: debts.filter((d) => d.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Debts</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3.5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          + Add Debt
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={loadDebts} />}

      {!loading && !error && debts.length === 0 && (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <div className="text-4xl mb-3">💳</div>
          <div className="text-sm text-gray-500">No debts recorded yet</div>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 text-sm text-gray-600 underline"
          >
            Add the first one
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        grouped.map(({ status, items }) => (
          <div key={status}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
              {status.replace('_', ' ')}
            </div>
            <div className="space-y-2.5">
              {items.map((debt) => (
                <div
                  key={debt.id}
                  className={`bg-white border rounded-xl p-4 ${debt.status === 'ACTIVE' ? 'border-gray-200' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{debt.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_BADGE[debt.type]}`}
                        >
                          {TYPE_LABEL[debt.type]}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[debt.status]}`}
                        >
                          {debt.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        <div>
                          <span className="text-gray-400">Principal </span>
                          <span className="font-mono tabular-nums text-gray-700">
                            {formatARS(debt.arsPrincipal)}
                          </span>
                          {debt.principalCurrency !== 'ARS' && (
                            <span className="text-gray-400 ml-1">
                              ({fmtOriginal(debt.originalPrincipal, debt.principalCurrency)})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-400">Balance </span>
                          <span className="font-mono tabular-nums text-gray-700">
                            {debt.currentBalanceOriginal.toLocaleString('es-AR')}{' '}
                            {debt.currentBalanceCurrency}
                          </span>
                        </div>
                        {debt.dueDate && (
                          <div>
                            <span className="text-gray-400">Due </span>
                            <span className="text-gray-700">{formatDate(debt.dueDate)}</span>
                          </div>
                        )}
                        {debt.interestRateAnnual != null && (
                          <div>
                            <span className="text-gray-400">Rate </span>
                            <span className="font-mono tabular-nums text-gray-700">
                              {Number(debt.interestRateAnnual).toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {debt.type === 'FIXED_INSTALLMENT' && debt.installmentAmount != null && (
                          <div>
                            <span className="text-gray-400">Installment </span>
                            <span className="font-mono tabular-nums text-gray-700">
                              {Number(debt.installmentAmount).toLocaleString('es-AR')}{' '}
                              {debt.installmentCurrency}
                            </span>
                            {debt.installmentCount && (
                              <span className="text-gray-400"> × {debt.installmentCount}</span>
                            )}
                          </div>
                        )}
                        {debt.type === 'REVOLVING' && debt.creditLimitOriginal != null && (
                          <div>
                            <span className="text-gray-400">Limit </span>
                            <span className="font-mono tabular-nums text-gray-700">
                              {Number(debt.creditLimitOriginal).toLocaleString('es-AR')}{' '}
                              {debt.principalCurrency}
                            </span>
                          </div>
                        )}
                      </div>
                      {debt.notes && (
                        <div className="mt-2 text-xs text-gray-400 italic">{debt.notes}</div>
                      )}
                    </div>
                    {debt.status === 'ACTIVE' && (
                      <button
                        onClick={() => {
                          setPayingDebt(debt);
                          setPayForm({
                            paymentDate: todayISO(),
                            originalAmount: '',
                            originalCurrency: debt.currentBalanceCurrency,
                            fxRate: '1',
                            arsAmount: '',
                            isMinimumPayment: false,
                            notes: '',
                          });
                        }}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* Add Debt Modal */}
      {showAdd && (
        <Modal title="Add Debt" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd} className="space-y-3.5">
            <div>
              <Label>Name</Label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(e) => setAddField('name', e.target.value)}
                className={inputCls}
                placeholder="e.g. Car loan, Credit card"
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={addForm.type}
                onChange={(e) => setAddField('type', e.target.value)}
                className={inputCls}
              >
                <option value="FIXED_INSTALLMENT">Fixed Installment</option>
                <option value="REVOLVING">Revolving</option>
              </select>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <Label>Principal Amount</Label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={addForm.originalPrincipal}
                  onChange={(e) => setAddField('originalPrincipal', e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label>Currency</Label>
                <select
                  value={addForm.principalCurrency}
                  onChange={(e) => setAddField('principalCurrency', e.target.value)}
                  className={inputCls}
                >
                  <option>ARS</option>
                  <option>USD</option>
                  <option>USDT</option>
                </select>
              </div>
            </div>
            {addForm.principalCurrency !== 'ARS' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>FX Rate (→ ARS)</Label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={addForm.fxRate}
                    onChange={(e) => setAddField('fxRate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>ARS Principal</Label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={addForm.arsPrincipal}
                    onChange={(e) => setAddForm((p) => ({ ...p, arsPrincipal: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Opened At</Label>
                <input
                  type="date"
                  required
                  value={addForm.openedAt}
                  onChange={(e) => setAddField('openedAt', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>
                  Due Date <span className="text-gray-400 font-normal">(opt.)</span>
                </Label>
                <input
                  type="date"
                  value={addForm.dueDate}
                  onChange={(e) => setAddField('dueDate', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <Label>
                Annual Interest Rate %{' '}
                <span className="text-gray-400 font-normal">(opt.)</span>
              </Label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={addForm.interestRateAnnual}
                onChange={(e) => setAddField('interestRateAnnual', e.target.value)}
                className={inputCls}
                placeholder="e.g. 35.00"
              />
            </div>
            {addForm.type === 'FIXED_INSTALLMENT' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label># Installments</Label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={addForm.installmentCount}
                    onChange={(e) => setAddField('installmentCount', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Amount each</Label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={addForm.installmentAmount}
                    onChange={(e) => setAddField('installmentAmount', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    value={addForm.installmentCurrency}
                    onChange={(e) => setAddField('installmentCurrency', e.target.value)}
                    className={inputCls}
                  >
                    <option>ARS</option>
                    <option>USD</option>
                    <option>USDT</option>
                  </select>
                </div>
              </div>
            )}
            {addForm.type === 'REVOLVING' && (
              <div>
                <Label>Credit Limit</Label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={addForm.creditLimitOriginal}
                  onChange={(e) => setAddField('creditLimitOriginal', e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={addBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {addBusy ? 'Adding…' : 'Add Debt'}
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

      {/* Record Payment Modal */}
      {payingDebt && (
        <Modal title={`Record Payment — ${payingDebt.name}`} onClose={() => setPayingDebt(null)}>
          <form onSubmit={submitPayment} className="space-y-3.5">
            <div>
              <Label>Payment Date</Label>
              <input
                type="date"
                required
                value={payForm.paymentDate}
                onChange={(e) => setPayField('paymentDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <Label>Amount</Label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={payForm.originalAmount}
                  onChange={(e) => setPayField('originalAmount', e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label>Currency</Label>
                <select
                  value={payForm.originalCurrency}
                  onChange={(e) => setPayField('originalCurrency', e.target.value)}
                  className={inputCls}
                >
                  <option>ARS</option>
                  <option>USD</option>
                  <option>USDT</option>
                </select>
              </div>
            </div>
            {payForm.originalCurrency !== 'ARS' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>FX Rate (→ ARS)</Label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={payForm.fxRate}
                    onChange={(e) => setPayField('fxRate', e.target.value)}
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
                    value={payForm.arsAmount}
                    onChange={(e) => setPayForm((p) => ({ ...p, arsAmount: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={payForm.isMinimumPayment}
                onChange={(e) => setPayForm((p) => ({ ...p, isMinimumPayment: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">This is the minimum payment</span>
            </label>
            <div>
              <Label>
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <input
                type="text"
                value={payForm.notes}
                onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                className={inputCls}
                placeholder="Optional note"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={payBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {payBusy ? 'Recording…' : 'Record Payment'}
              </button>
              <button
                type="button"
                onClick={() => setPayingDebt(null)}
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
