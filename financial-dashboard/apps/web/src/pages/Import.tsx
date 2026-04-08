import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { formatARS } from '../utils/format.js';
import { inputCls, Label, Spinner } from '../components/ui/shared.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedPayload {
  version: 1;
  documentType: 'INCOME' | 'CREDIT_CARD_STATEMENT' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  extractionMethod: 'PDF_TEXT' | 'IMAGE_ONLY' | 'UNSUPPORTED_FORMAT';
  rawTextSnippet?: string;
  income?: {
    amount?: number;
    currency?: 'ARS' | 'USD' | 'USDT';
    date?: string;
    period?: string;
    description?: string;
  };
  statement?: {
    issuer?: string;
    closingDate?: string;
    dueDate?: string;
    totalDue?: number;
    minimumPayment?: number;
    currency?: 'ARS' | 'USD' | 'USDT';
  };
}

type StepId = 'upload' | 'review' | 'done';
type Currency = 'ARS' | 'USD' | 'USDT';
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
  const dot = {
    HIGH: 'bg-emerald-500',
    MEDIUM: 'bg-amber-400',
    LOW: 'bg-rose-500',
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
    >
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
      <button
        onClick={onDismiss}
        className="text-rose-400 hover:text-rose-700 text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}

// ─── FX helper ───────────────────────────────────────────────────────────────

async function fetchLatestRate(
  apiBase: string,
  currency: Currency,
): Promise<{ rate: string; id: string }> {
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
    // Non-fatal — user can enter the rate manually
  }
  return { rate: '', id: '' };
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
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Income details
      </div>
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
          <select
            value={form.currency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className={inputCls}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Date</Label>
        <input
          type="date"
          value={form.entryDate}
          onChange={(e) => onChange({ ...form, entryDate: e.target.value })}
          className={inputCls}
        />
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

// ─── Statement form fields ────────────────────────────────────────────────────

function StatementFormFields({
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
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Statement details
      </div>
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
          <input
            type="date"
            value={form.closingDate}
            onChange={(e) => onChange({ ...form, closingDate: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <Label>Due date</Label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => onChange({ ...form, dueDate: e.target.value })}
            className={inputCls}
          />
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
          <Label>Minimum payment (optional)</Label>
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
          <select
            value={form.currency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className={inputCls}
          >
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

  // Upload step state
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('INVOICE');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review step state
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

  // Done step state
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

  // ─── Computed ──────────────────────────────────────────────────────────────
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
            extractions?: Array<{ id: string; rawExtractedJson: unknown }>;
          };
          extraction?: { id: string; rawExtractedJson: unknown };
        };
        error?: { message: string };
      };

      if (!json.ok) throw new Error(json.error?.message ?? 'Upload failed');

      const { document, extraction, isDuplicate } = json.data;

      // Normalize extraction source (new vs duplicate)
      const ext =
        !isDuplicate && extraction
          ? extraction
          : isDuplicate && document.extractions?.[0]
            ? document.extractions[0]
            : null;

      if (!ext) throw new Error('No extraction data returned. The document may not be parseable.');

      setDocumentId(document.id);
      setExtractionId(ext.id);

      const p = ext.rawExtractedJson as ExtractedPayload;
      setPayload(p);
      setResolvedType(p.documentType === 'CREDIT_CARD_STATEMENT' ? 'CREDIT_CARD_STATEMENT' : 'INCOME');
      setStep('review');
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCurrencyChange(
    currency: Currency,
    which: 'income' | 'statement',
  ) {
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
      // 1. Record approval
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

      // 2. Import items
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
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Import a document</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload an income document or credit card statement. We'll extract the key fields for
              you to review before anything is saved.
            </p>
          </div>

          {uploadError && (
            <InlineError message={uploadError} onDismiss={() => setUploadError(null)} />
          )}

          {/* Document type */}
          <div>
            <Label>Document type</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={inputCls}
            >
              <option value="INVOICE">Invoice / Pay stub</option>
              <option value="CREDIT_CARD_STATEMENT">Credit card statement</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* File picker */}
          <div>
            <Label>File (PDF or CSV, max 10 MB)</Label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                Analyzing document…
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
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Review extracted data</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Check and correct the values below. Nothing is saved until you confirm.
                </p>
              </div>
              <ConfidenceBadge level={payload.confidence} />
            </div>

            {/* Extraction method notice */}
            {payload.extractionMethod === 'IMAGE_ONLY' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-500 shrink-0 text-sm mt-0.5">▲</span>
                <p className="text-xs text-amber-800">
                  This looks like a scanned document — text extraction was not possible. Please
                  fill in the fields manually.
                </p>
              </div>
            )}

            {/* Unknown type: show snippet + type selector */}
            {payload.documentType === 'UNKNOWN' && (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
                  <p className="text-xs font-medium text-gray-600">
                    We couldn't identify the document type automatically.
                  </p>
                  {payload.rawTextSnippet && (
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
                      {payload.rawTextSnippet.slice(0, 300)}
                    </pre>
                  )}
                </div>
                <div>
                  <Label>Select document type</Label>
                  <select
                    value={resolvedType}
                    onChange={(e) => setResolvedType(e.target.value as ResolvedType)}
                    className={inputCls}
                  >
                    <option value="INCOME">Income / Invoice</option>
                    <option value="CREDIT_CARD_STATEMENT">Credit card statement</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {reviewError && (
            <InlineError message={reviewError} onDismiss={() => setReviewError(null)} />
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
              <StatementFormFields
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
              {importedItems.length}{' '}
              {importedItems.length === 1 ? 'record' : 'records'} added to your financial data.
              The dashboard and daily budget reflect the new entries.
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
