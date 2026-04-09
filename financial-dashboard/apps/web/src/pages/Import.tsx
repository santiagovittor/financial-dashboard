import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { formatARS } from '../utils/format.js';
import { inputCls, Label, Spinner } from '../components/ui/shared.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type Currency = 'ARS' | 'USD' | 'USDT';
type SpendingCategory =
  | 'groceries'
  | 'transport'
  | 'dining'
  | 'shopping'
  | 'subscriptions'
  | 'utilities'
  | 'health'
  | 'taxes_fees'
  | 'debt_cost'
  | 'other';

interface LineItem {
  date?: string;
  description: string;
  amount: number;
  currency: Currency;
  category?: SpendingCategory;
  essential?: boolean;
  recurring?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
}

interface StatementSummary {
  issuer?: string;
  cardName?: string;
  statementPeriod?: string;
  closingDate?: string;
  dueDate?: string;
  minimumPayment?: number;
  totalDue?: number;
  currency?: Currency;
  totalArs?: number;
  totalUsd?: number;
  taxesAndFees?: number;
  interest?: number;
  lineItems?: LineItem[];
  warnings?: string[];
}

interface ExtractedIncome {
  amount?: number;
  currency?: Currency;
  date?: string;
  period?: string;
  description?: string;
}

interface ExtractedPayload {
  version: 1;
  documentType: 'INCOME' | 'CREDIT_CARD_STATEMENT' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  extractionMethod: 'GEMINI_PDF' | 'IMAGE_ONLY' | 'UNSUPPORTED_FORMAT' | 'PENDING_LLM';
  rawTextSnippet?: string;
  income?: ExtractedIncome;
  statement?: StatementSummary;
}

type StepId = 'upload' | 'review' | 'done';
type ResolvedType = 'INCOME' | 'CREDIT_CARD_STATEMENT';

interface IncomeForm {
  amount: string;
  currency: Currency;
  entryDate: string;
  description: string;
  fxRate: string;
  fxSnapshotId: string;
}

interface StatementForm {
  issuer: string;
  closingDate: string;
  dueDate: string;
  totalDue: string;
  minimumPayment: string;
  currency: Currency;
  fxRate: string;
  fxSnapshotId: string;
}

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<SpendingCategory, string> = {
  groceries: 'Groceries',
  transport: 'Transport',
  dining: 'Dining',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  utilities: 'Utilities',
  health: 'Health',
  taxes_fees: 'Taxes & Fees',
  debt_cost: 'Debt Cost',
  other: 'Other',
};

const CATEGORY_ICON: Record<SpendingCategory, string> = {
  groceries: '🛒',
  transport: '🚌',
  dining: '🍽️',
  shopping: '🛍️',
  subscriptions: '📱',
  utilities: '💡',
  health: '🏥',
  taxes_fees: '🏛️',
  debt_cost: '💳',
  other: '•',
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

function StepIndicator({ current }: { current: StepId }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                i < currentIdx
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : i === currentIdx
                    ? 'bg-white border-gray-900 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                i === currentIdx ? 'text-gray-900' : i < currentIdx ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-3 h-px w-6 transition-colors ${i < currentIdx ? 'bg-gray-400' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = {
    HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    LOW: 'bg-rose-50 text-rose-700 border-rose-200',
  }[level];
  const dot = { HIGH: 'bg-emerald-500', MEDIUM: 'bg-amber-400', LOW: 'bg-rose-500' }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {level} confidence
    </span>
  );
}

// ─── Inline error ─────────────────────────────────────────────────────────────

function InlineError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
      <span className="text-rose-700 text-sm flex-1">{message}</span>
      <button onClick={onDismiss} className="text-rose-400 hover:text-rose-700 text-lg leading-none shrink-0">×</button>
    </div>
  );
}

// ─── FX helper ────────────────────────────────────────────────────────────────

async function fetchLatestRate(apiBase: string, currency: Currency): Promise<{ rate: string; id: string }> {
  if (currency === 'ARS') return { rate: '1', id: '' };
  try {
    const res = await fetch(`${apiBase}/api/v1/rates/latest`, { credentials: 'include' });
    const json = (await res.json()) as {
      ok: boolean;
      data: Array<{ id: string; fromCurrency: string; toCurrency: string; rate: number }>;
    };
    const match = json.ok ? json.data.find((r) => r.fromCurrency === currency) : undefined;
    if (match) return { rate: String(match.rate), id: match.id };
  } catch {
    /* non-fatal */
  }
  return { rate: '', id: '' };
}

// ─── Statement analysis view ──────────────────────────────────────────────────

function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function CategoryBar({ label, amount, total, icon }: { label: string; amount: number; total: number; icon: string }) {
  const fraction = total > 0 ? Math.min(amount / total, 1) : 0;
  return (
    <div className="grid grid-cols-[16px_1fr_auto] items-center gap-2 text-xs">
      <span>{icon}</span>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-500 ml-2">{pct(amount, total)}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-700 rounded-full" style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
      <span className="font-mono text-gray-900 text-right tabular-nums">{formatARS(amount)}</span>
    </div>
  );
}

function StatementAnalysisPanel({ stmt, fxRate }: { stmt: StatementSummary; fxRate: string }) {
  const [lineItemsExpanded, setLineItemsExpanded] = useState(false);

  const items = stmt.lineItems ?? [];
  const totalDue = stmt.totalDue ?? 0;
  const minPayment = stmt.minimumPayment ?? 0;
  const taxesAndFees = stmt.taxesAndFees ?? 0;
  const interest = stmt.interest ?? 0;

  // Category breakdown (convert USD items to ARS for comparison)
  const rate = parseFloat(fxRate) || 1;
  const categoryTotals: Partial<Record<SpendingCategory, number>> = {};
  for (const item of items) {
    const cat = item.category ?? 'other';
    const arsValue = item.currency === 'ARS' ? item.amount : item.amount * rate;
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + arsValue;
  }
  const categorySorted = (Object.entries(categoryTotals) as Array<[SpendingCategory, number]>).sort(
    (a, b) => b[1] - a[1],
  );

  // Essential vs discretionary
  const essentialTotal = items
    .filter((i) => i.essential === true)
    .reduce((s, i) => s + (i.currency === 'ARS' ? i.amount : i.amount * rate), 0);
  const discretionaryTotal = items
    .filter((i) => i.essential === false)
    .reduce((s, i) => s + (i.currency === 'ARS' ? i.amount : i.amount * rate), 0);
  const classifiedTotal = essentialTotal + discretionaryTotal;

  // Installment items
  const installmentItems = items.filter((i) => i.installmentTotal && i.installmentTotal > 1);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {[stmt.issuer, stmt.cardName].filter(Boolean).join(' · ') || 'Credit card statement'}
              </p>
              {stmt.statementPeriod && (
                <p className="text-xs text-gray-500 mt-0.5">{stmt.statementPeriod}</p>
              )}
            </div>
          </div>
          {(stmt.closingDate || stmt.dueDate) && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {stmt.closingDate && <span>Closing: <span className="text-gray-700">{stmt.closingDate}</span></span>}
              {stmt.dueDate && <span>Due: <span className="text-gray-700">{stmt.dueDate}</span></span>}
            </div>
          )}
        </div>

        {/* Payment summary */}
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Payment summary</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {totalDue > 0 && (
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-xs text-gray-600">Total due</span>
                <span className="font-mono text-sm font-semibold text-gray-900">{formatARS(totalDue)}</span>
              </div>
            )}
            {minPayment > 0 && (
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-xs text-gray-600">Minimum payment</span>
                <span className="font-mono text-xs text-gray-700">{formatARS(minPayment)}</span>
              </div>
            )}
            {stmt.totalArs != null && stmt.totalArs > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">ARS charges</span>
                <span className="font-mono text-xs text-gray-600">{formatARS(stmt.totalArs)}</span>
              </div>
            )}
            {stmt.totalUsd != null && stmt.totalUsd > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">USD charges</span>
                <span className="font-mono text-xs text-gray-600">
                  US$ {stmt.totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {taxesAndFees > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Taxes & fees</span>
                <span className="font-mono text-xs text-amber-700">
                  {formatARS(taxesAndFees)}
                  {totalDue > 0 && <span className="text-gray-400 ml-1">({pct(taxesAndFees, totalDue)})</span>}
                </span>
              </div>
            )}
            {interest > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Interest</span>
                <span className="font-mono text-xs text-rose-600">{formatARS(interest)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spending breakdown */}
      {categorySorted.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Spending by category</p>
            <span className="text-xs text-gray-400">{items.length} items</span>
          </div>
          <div className="space-y-2.5">
            {categorySorted.map(([cat, amount]) => (
              <CategoryBar
                key={cat}
                label={CATEGORY_LABEL[cat]}
                icon={CATEGORY_ICON[cat]}
                amount={amount}
                total={categorySorted.reduce((s, [, v]) => s + v, 0)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Essential vs discretionary */}
      {classifiedTotal > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Essential vs discretionary</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-400 rounded-l-full"
              style={{ width: pct(essentialTotal, classifiedTotal) }}
            />
            <div
              className="h-full bg-amber-400 rounded-r-full"
              style={{ width: pct(discretionaryTotal, classifiedTotal) }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-gray-600">Essential</span>
              <span className="font-mono text-gray-900">{pct(essentialTotal, classifiedTotal)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-gray-600">Discretionary</span>
              <span className="font-mono text-gray-900">{pct(discretionaryTotal, classifiedTotal)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Installments */}
      {installmentItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Active installments</p>
          <div className="space-y-1.5">
            {installmentItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate flex-1 mr-2">{item.description}</span>
                <span className="text-gray-400 shrink-0">
                  {item.installmentCurrent}/{item.installmentTotal}
                </span>
                <span className="font-mono text-gray-900 ml-3 shrink-0">{formatARS(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line items */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-colors"
            onClick={() => setLineItemsExpanded((v) => !v)}
          >
            <span>Line items ({items.length})</span>
            <span className="text-gray-300">{lineItemsExpanded ? '▲' : '▼'}</span>
          </button>
          {lineItemsExpanded && (
            <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-2.5">
                  <span className="text-base leading-none mt-0.5 shrink-0">
                    {item.category ? CATEGORY_ICON[item.category] : '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 truncate">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.date && <span className="text-[10px] text-gray-400">{item.date}</span>}
                      {item.installmentTotal && item.installmentTotal > 1 && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.installmentCurrent}/{item.installmentTotal}
                        </span>
                      )}
                      {item.recurring && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">recurring</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-gray-900">{formatARS(item.amount)}</p>
                    {item.currency !== 'ARS' && (
                      <p className="text-[10px] text-gray-400">{item.currency}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {stmt.warnings && stmt.warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-widest">Extraction notes</p>
          {stmt.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Income form fields ───────────────────────────────────────────────────────

function IncomeFormFields({
  form,
  onChange,
  onCurrencyChange,
}: {
  form: IncomeForm;
  onChange: (f: IncomeForm) => void;
  onCurrencyChange: (c: Currency) => void;
}) {
  const arsAmount = parseFloat(form.amount) * parseFloat(form.fxRate);
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Income details</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Amount</Label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        <div>
          <Label>Currency</Label>
          <select value={form.currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)} className={inputCls}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Date</Label>
        <input type="date" value={form.entryDate} onChange={(e) => onChange({ ...form, entryDate: e.target.value })} className={inputCls} />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="e.g. March salary"
          maxLength={500}
          className={inputCls}
        />
      </div>
      {form.currency !== 'ARS' && (
        <div>
          <Label>FX Rate ({form.currency} → ARS)</Label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.fxRate}
            onChange={(e) => onChange({ ...form, fxRate: e.target.value })}
            placeholder="e.g. 1050.00"
            className={inputCls}
          />
        </div>
      )}
      {form.amount && form.fxRate && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-xs text-gray-500">ARS equivalent</span>
          <span className="font-mono text-sm font-semibold text-gray-900">
            {isNaN(arsAmount) ? '—' : formatARS(arsAmount)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Statement confirm form ───────────────────────────────────────────────────

function StatementConfirmForm({
  form,
  onChange,
  onCurrencyChange,
}: {
  form: StatementForm;
  onChange: (f: StatementForm) => void;
  onCurrencyChange: (c: Currency) => void;
}) {
  const arsAmount = parseFloat(form.totalDue) * parseFloat(form.fxRate);
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Confirm & import</div>
      <p className="text-xs text-gray-500">
        Review and adjust the values below. One expense entry will be created for the total due.
      </p>
      <div>
        <Label>Card issuer</Label>
        <input
          type="text"
          value={form.issuer}
          onChange={(e) => onChange({ ...form, issuer: e.target.value })}
          placeholder="e.g. Visa, Mastercard"
          maxLength={100}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Closing date</Label>
          <input type="date" value={form.closingDate} onChange={(e) => onChange({ ...form, closingDate: e.target.value })} className={inputCls} />
        </div>
        <div>
          <Label>Due date</Label>
          <input type="date" value={form.dueDate} onChange={(e) => onChange({ ...form, dueDate: e.target.value })} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Total due</Label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.totalDue}
            onChange={(e) => onChange({ ...form, totalDue: e.target.value })}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        <div>
          <Label>Minimum payment</Label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.minimumPayment}
            onChange={(e) => onChange({ ...form, minimumPayment: e.target.value })}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Currency</Label>
          <select value={form.currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)} className={inputCls}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        {form.currency !== 'ARS' && (
          <div>
            <Label>FX Rate ({form.currency} → ARS)</Label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.fxRate}
              onChange={(e) => onChange({ ...form, fxRate: e.target.value })}
              placeholder="e.g. 1050.00"
              className={inputCls}
            />
          </div>
        )}
      </div>
      {form.totalDue && form.fxRate && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-xs text-gray-500">ARS equivalent (total due)</span>
          <span className="font-mono text-sm font-semibold text-gray-900">
            {isNaN(arsAmount) ? '—' : formatARS(arsAmount)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Import() {
  const API = import.meta.env['VITE_API_URL'] as string;

  const [step, setStep] = useState<StepId>('upload');

  // Upload step
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('INVOICE');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review step
  const [documentId, setDocumentId] = useState('');
  const [extractionId, setExtractionId] = useState('');
  const [payload, setPayload] = useState<ExtractedPayload | null>(null);
  const [resolvedType, setResolvedType] = useState<ResolvedType>('INCOME');
  const [incomeForm, setIncomeForm] = useState<IncomeForm>({
    amount: '',
    currency: 'ARS',
    entryDate: '',
    description: '',
    fxRate: '1',
    fxSnapshotId: '',
  });
  const [stmtForm, setStmtForm] = useState<StatementForm>({
    issuer: '',
    closingDate: '',
    dueDate: '',
    totalDue: '',
    minimumPayment: '',
    currency: 'ARS',
    fxRate: '1',
    fxSnapshotId: '',
  });
  const [confirming, setConfirming] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Done step
  const [importedItems, setImportedItems] = useState<Array<{ type: string; id: string }>>([]);

  // Initialize review forms when payload / resolvedType changes
  useEffect(() => {
    if (!payload) return;

    async function init() {
      if (!payload) return;
      const isIncome =
        payload.documentType === 'INCOME' ||
        (payload.documentType === 'UNKNOWN' && resolvedType === 'INCOME');
      const isStatement =
        payload.documentType === 'CREDIT_CARD_STATEMENT' ||
        (payload.documentType === 'UNKNOWN' && resolvedType === 'CREDIT_CARD_STATEMENT');

      if (isIncome) {
        const currency = (payload.income?.currency ?? 'ARS') as Currency;
        const { rate, id } = await fetchLatestRate(API, currency);
        setIncomeForm({
          amount: String(payload.income?.amount ?? ''),
          currency,
          entryDate: payload.income?.date ?? '',
          description: payload.income?.description ?? '',
          fxRate: rate,
          fxSnapshotId: id,
        });
      }

      if (isStatement) {
        const currency = (payload.statement?.currency ?? 'ARS') as Currency;
        const { rate, id } = await fetchLatestRate(API, currency);
        setStmtForm({
          issuer: payload.statement?.issuer ?? '',
          closingDate: payload.statement?.closingDate ?? '',
          dueDate: payload.statement?.dueDate ?? '',
          totalDue: String(payload.statement?.totalDue ?? ''),
          minimumPayment: String(payload.statement?.minimumPayment ?? ''),
          currency,
          fxRate: rate,
          fxSnapshotId: id,
        });
      }
    }

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, resolvedType]);

  const canConfirm =
    resolvedType === 'INCOME'
      ? !!(incomeForm.amount && incomeForm.entryDate && incomeForm.fxRate)
      : !!(stmtForm.totalDue && stmtForm.dueDate && stmtForm.fxRate);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', docType);

      const res = await fetch(`${API}/api/v1/documents`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const json = (await res.json()) as {
        ok: boolean;
        data: {
          isDuplicate: boolean;
          document: {
            id: string;
            extractions?: Array<{ id: string; status: string; errorMessage?: string | null; rawExtractedJson: unknown }>;
          };
          extraction?: { id: string; status: string; errorMessage?: string | null; rawExtractedJson: unknown };
        };
        error?: { message: string };
      };

      if (!json.ok) throw new Error(json.error?.message ?? 'Upload failed');

      const { document, extraction, isDuplicate } = json.data;
      const ext =
        !isDuplicate && extraction
          ? extraction
          : isDuplicate && document.extractions?.[0]
            ? document.extractions[0]
            : null;

      if (!ext) throw new Error('No extraction data returned. The document may not be parseable.');

      setDocumentId(document.id);
      setExtractionId(ext.id);

      const p = ext.rawExtractedJson as ExtractedPayload | null;
      if (!p) {
        const reason = ext.errorMessage;
        throw new Error(
          reason
            ? `Extraction failed: ${reason}`
            : 'Extraction did not produce any data — the document could not be analysed. Check that the file is a readable PDF and try again.',
        );
      }
      setPayload(p);
      setResolvedType(p.documentType === 'CREDIT_CARD_STATEMENT' ? 'CREDIT_CARD_STATEMENT' : 'INCOME');
      setStep('review');
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCurrencyChange(currency: Currency, which: 'income' | 'statement') {
    const { rate, id } = await fetchLatestRate(API, currency);
    if (which === 'income') {
      setIncomeForm((f) => ({ ...f, currency, fxRate: rate, fxSnapshotId: id }));
    } else {
      setStmtForm((f) => ({ ...f, currency, fxRate: rate, fxSnapshotId: id }));
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setReviewError(null);
    try {
      const reviewRes = await fetch(
        `${API}/api/v1/documents/${documentId}/extractions/${extractionId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'APPROVED' }),
          credentials: 'include',
        },
      );
      const reviewJson = (await reviewRes.json()) as { ok: boolean; error?: { message: string } };
      if (!reviewJson.ok) throw new Error(reviewJson.error?.message ?? 'Review failed');

      const isIncome = resolvedType === 'INCOME';
      const items = isIncome
        ? [
            {
              type: 'INCOME_ENTRY' as const,
              entryDate: incomeForm.entryDate,
              description: incomeForm.description || undefined,
              originalAmount: parseFloat(incomeForm.amount),
              originalCurrency: incomeForm.currency,
              fxRate: parseFloat(incomeForm.fxRate),
              arsAmount: parseFloat(incomeForm.amount) * parseFloat(incomeForm.fxRate),
              fxSnapshotId: incomeForm.fxSnapshotId || undefined,
            },
          ]
        : [
            {
              type: 'EXPENSE_ENTRY' as const,
              entryDate: stmtForm.dueDate,
              description: stmtForm.issuer
                ? `${stmtForm.issuer} — resumen`
                : 'Credit card statement',
              originalAmount: parseFloat(stmtForm.totalDue),
              originalCurrency: stmtForm.currency,
              fxRate: parseFloat(stmtForm.fxRate),
              arsAmount: parseFloat(stmtForm.totalDue) * parseFloat(stmtForm.fxRate),
              fxSnapshotId: stmtForm.fxSnapshotId || undefined,
            },
          ];

      const importRes = await fetch(
        `${API}/api/v1/documents/${documentId}/extractions/${extractionId}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
          credentials: 'include',
        },
      );
      const importJson = (await importRes.json()) as {
        ok: boolean;
        data: Array<{ type: string; id: string }>;
        error?: { message: string };
      };
      if (!importJson.ok) throw new Error(importJson.error?.message ?? 'Import failed');

      setImportedItems(importJson.data);
      setStep('done');
    } catch (e) {
      setReviewError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setDocType('INVOICE');
    setUploadError(null);
    setDocumentId('');
    setExtractionId('');
    setPayload(null);
    setImportedItems([]);
    setReviewError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl space-y-5">
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Import a document</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload a credit card statement or income document. AI reads the PDF directly and
              extracts structured data for you to review before anything is saved.
            </p>
          </div>

          {uploadError && <InlineError message={uploadError} onDismiss={() => setUploadError(null)} />}

          <div>
            <Label>Document type</Label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls}>
              <option value="CREDIT_CARD_STATEMENT">Credit card statement</option>
              <option value="INVOICE">Invoice / Pay stub</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <Label>File (PDF, max 10 MB)</Label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setUploadError(null);
                }}
              />
              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                  <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm text-gray-500">Click to select a file</div>
                  <div className="text-xs text-gray-400">PDF or CSV</div>
                </div>
              )}
            </div>
          </div>

          <button
            disabled={!file || uploading}
            onClick={handleUpload}
            className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                Analyzing with AI…
              </span>
            ) : (
              'Upload and analyze'
            )}
          </button>
        </div>
      )}

      {/* ── Step 2: Review ─────────────────────────────────────────────────── */}
      {step === 'review' && payload && (
        <div className="space-y-4">
          {/* Extraction header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AI extraction results</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Review the extracted data. Nothing is saved until you confirm.
                </p>
              </div>
              <ConfidenceBadge level={payload.confidence} />
            </div>

            {/* Extraction not configured notice */}
            {payload.extractionMethod === 'PENDING_LLM' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-500 shrink-0 text-sm mt-0.5">▲</span>
                <p className="text-xs text-amber-800">
                  AI extraction is not configured. Set <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> in your environment to enable automatic PDF analysis.
                  Fill in the fields below manually.
                </p>
              </div>
            )}

            {/* Image-only notice */}
            {payload.extractionMethod === 'IMAGE_ONLY' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-500 shrink-0 text-sm mt-0.5">▲</span>
                <p className="text-xs text-amber-800">
                  This looks like a scanned document. Please fill in the fields manually.
                </p>
              </div>
            )}

            {/* Unknown type selector */}
            {payload.documentType === 'UNKNOWN' && (
              <div className="space-y-3">
                {payload.rawTextSnippet && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 mb-1">Document preview</p>
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
                      {payload.rawTextSnippet.slice(0, 300)}
                    </pre>
                  </div>
                )}
                <div>
                  <Label>Select document type</Label>
                  <select
                    value={resolvedType}
                    onChange={(e) => setResolvedType(e.target.value as ResolvedType)}
                    className={inputCls}
                  >
                    <option value="CREDIT_CARD_STATEMENT">Credit card statement</option>
                    <option value="INCOME">Income / Invoice</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {reviewError && <InlineError message={reviewError} onDismiss={() => setReviewError(null)} />}

          {/* Statement analysis */}
          {(resolvedType === 'CREDIT_CARD_STATEMENT') && payload.statement && (
            <StatementAnalysisPanel stmt={payload.statement} fxRate={stmtForm.fxRate} />
          )}

          {/* Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {resolvedType === 'INCOME' ? (
              <IncomeFormFields
                form={incomeForm}
                onChange={setIncomeForm}
                onCurrencyChange={(c) => void handleCurrencyChange(c, 'income')}
              />
            ) : (
              <StatementConfirmForm
                form={stmtForm}
                onChange={setStmtForm}
                onCurrencyChange={(c) => void handleCurrencyChange(c, 'statement')}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              disabled={confirming || !canConfirm}
              onClick={handleConfirm}
              className="flex-[2] py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {confirming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  Importing…
                </span>
              ) : (
                'Confirm import'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ───────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
              ✓
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Import complete</h2>
            <p className="text-xs text-gray-500">
              {importedItems.length} {importedItems.length === 1 ? 'record' : 'records'} added to your financial data.
            </p>
          </div>

          <div className="space-y-1.5">
            {importedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {item.type === 'INCOME_ENTRY' ? 'Income entry created' : 'Expense entry created'}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <Link
              to="/"
              className="flex-1 py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors text-center"
            >
              Go to Dashboard
            </Link>
            <button
              onClick={reset}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
