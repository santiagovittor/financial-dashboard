import { useState, useEffect, useCallback } from 'react';
import { formatARS, todayISO } from '../utils/format.js';
import { Modal, Spinner, ErrorBox, Label, inputCls } from '../components/ui/shared.js';

interface FxSnapshot {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number | string;
  effectiveDate: string;
  notes?: string;
}

interface RiskSetting {
  id: string;
  key: string;
  value: number;
  description?: string;
}

interface Goal {
  id: string;
  name: string;
  targetArs: number;
  currentArs: number;
  targetDate?: string;
  isCompleted: boolean;
  notes?: string;
}

const RISK_KEY_LABELS: Record<string, string> = {
  daily_spend_warning_ratio: 'Daily Spend Warning',
  daily_spend_danger_ratio: 'Daily Spend Danger',
  debt_to_income_warning_ratio: 'Debt/Income Warning',
  debt_to_income_danger_ratio: 'Debt/Income Danger',
};
const RISK_DEFAULTS: Record<string, number> = {
  daily_spend_warning_ratio: 0.8,
  daily_spend_danger_ratio: 1.0,
  debt_to_income_warning_ratio: 0.3,
  debt_to_income_danger_ratio: 0.5,
};

function GoalCard({
  goal,
  onUpdate,
}: {
  goal: Goal;
  onUpdate: (g: Goal) => void;
}) {
  const pct = goal.targetArs > 0 ? Math.min(100, (goal.currentArs / goal.targetArs) * 100) : 0;
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${goal.isCompleted ? 'border-emerald-200 opacity-75' : 'border-gray-200'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{goal.name}</span>
          {goal.isCompleted && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
              Complete
            </span>
          )}
        </div>
        {!goal.isCompleted && (
          <button
            onClick={() => onUpdate(goal)}
            className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors"
          >
            Update
          </button>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all ${goal.isCompleted ? 'bg-emerald-500' : 'bg-gray-700'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-mono tabular-nums">{formatARS(goal.currentArs)}</span>
        <span className="font-mono tabular-nums">{formatARS(goal.targetArs)} target</span>
      </div>
      {goal.targetDate && (
        <div className="mt-1 text-[11px] text-gray-400">
          Due {new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('es-AR')}
        </div>
      )}
    </div>
  );
}

export function Settings() {
  // FX
  const [fxLatest, setFxLatest] = useState<FxSnapshot[]>([]);
  const [fxHistory, setFxHistory] = useState<FxSnapshot[]>([]);
  const [fxLoading, setFxLoading] = useState(true);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxForm, setFxForm] = useState({
    fromCurrency: 'USD',
    effectiveDate: todayISO(),
    rate: '',
    notes: '',
  });
  const [fxBusy, setFxBusy] = useState(false);

  // Risk
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [riskEdits, setRiskEdits] = useState<Record<string, string>>({});
  const [riskSaving, setRiskSaving] = useState<string | null>(null);

  // Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetArs: '',
    targetDate: '',
    notes: '',
  });
  const [goalBusy, setGoalBusy] = useState(false);
  const [patchingGoal, setPatchingGoal] = useState<Goal | null>(null);
  const [patchForm, setPatchForm] = useState({ currentArs: '', isCompleted: false });
  const [patchBusy, setPatchBusy] = useState(false);

  const loadFx = useCallback(async () => {
    setFxLoading(true);
    setFxError(null);
    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/rates/latest`, { credentials: 'include' }),
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/rates`, { credentials: 'include' }),
      ]);
      const latestJson = await latestRes.json();
      const historyJson = await historyRes.json();
      if (!latestJson.ok) throw new Error(latestJson.message ?? 'Failed to load rates');
      setFxLatest(latestJson.data);
      if (historyJson.ok) setFxHistory((historyJson.data as FxSnapshot[]).slice(0, 10));
    } catch (e) {
      setFxError((e as Error).message);
    } finally {
      setFxLoading(false);
    }
  }, []);

  const loadRisks = useCallback(async () => {
    setRiskLoading(true);
    setRiskError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/risks`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load risk settings');
      const edits: Record<string, string> = {};
      for (const key of Object.keys(RISK_DEFAULTS)) {
        const found = (json.data as RiskSetting[]).find((r) => r.key === key);
        edits[key] = String(found ? Number(found.value) : RISK_DEFAULTS[key]);
      }
      setRiskEdits(edits);
    } catch (e) {
      setRiskError((e as Error).message);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/goals`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load goals');
      setGoals(json.data);
    } catch (e) {
      setGoalsError((e as Error).message);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFx();
    loadRisks();
    loadGoals();
  }, [loadFx, loadRisks, loadGoals]);

  async function submitFx(e: { preventDefault(): void }) {
    e.preventDefault();
    setFxBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/rates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency: fxForm.fromCurrency,
          effectiveDate: fxForm.effectiveDate,
          rate: parseFloat(fxForm.rate),
          ...(fxForm.notes ? { notes: fxForm.notes } : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to save rate');
      setFxForm((p) => ({ ...p, rate: '', notes: '' }));
      loadFx();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setFxBusy(false);
    }
  }

  async function saveRisk(key: string) {
    setRiskSaving(key);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/risks/${key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseFloat(riskEdits[key] ?? '0') }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to save');
      loadRisks();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRiskSaving(null);
    }
  }

  async function submitGoal(e: { preventDefault(): void }) {
    e.preventDefault();
    setGoalBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/goals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: goalForm.name,
          targetArs: parseFloat(goalForm.targetArs),
          ...(goalForm.targetDate ? { targetDate: goalForm.targetDate } : {}),
          ...(goalForm.notes ? { notes: goalForm.notes } : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to create goal');
      setShowAddGoal(false);
      setGoalForm({ name: '', targetArs: '', targetDate: '', notes: '' });
      loadGoals();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGoalBusy(false);
    }
  }

  async function submitPatch(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!patchingGoal) return;
    setPatchBusy(true);
    try {
      const body: Record<string, unknown> = { isCompleted: patchForm.isCompleted };
      if (patchForm.currentArs !== '') body.currentArs = parseFloat(patchForm.currentArs);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/goals/${patchingGoal.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to update goal');
      setPatchingGoal(null);
      loadGoals();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPatchBusy(false);
    }
  }

  function openPatch(g: Goal) {
    setPatchingGoal(g);
    setPatchForm({ currentArs: String(g.currentArs), isCompleted: g.isCompleted });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* FX Rates */}
      <section>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          FX Rates
        </div>
        {fxLoading && <Spinner />}
        {fxError && <ErrorBox message={fxError} onRetry={loadFx} />}
        {!fxLoading && !fxError && (
          <div className="grid grid-cols-2 gap-5">
            {/* Current + update form */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Current rates (→ ARS)</div>
                {fxLatest.length === 0 ? (
                  <div className="text-sm text-gray-400">No rates recorded yet</div>
                ) : (
                  <div className="space-y-2">
                    {fxLatest.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {s.fromCurrency} → ARS
                        </span>
                        <div className="text-right">
                          <div className="font-mono tabular-nums text-sm text-gray-900">
                            {Number(s.rate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {new Date(String(s.effectiveDate)).toLocaleDateString('es-AR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={submitFx}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
              >
                <div className="text-xs font-medium text-gray-500">Record a new rate</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>From</Label>
                    <select
                      value={fxForm.fromCurrency}
                      onChange={(e) => setFxForm((p) => ({ ...p, fromCurrency: e.target.value }))}
                      className={inputCls}
                    >
                      <option>USD</option>
                      <option>USDT</option>
                    </select>
                  </div>
                  <div>
                    <Label>Rate (→ ARS)</Label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={fxForm.rate}
                      onChange={(e) => setFxForm((p) => ({ ...p, rate: e.target.value }))}
                      className={inputCls}
                      placeholder="1285.50"
                    />
                  </div>
                  <div>
                    <Label>Effective Date</Label>
                    <input
                      type="date"
                      required
                      value={fxForm.effectiveDate}
                      onChange={(e) =>
                        setFxForm((p) => ({ ...p, effectiveDate: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={fxBusy}
                  className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {fxBusy ? 'Saving…' : 'Save Rate'}
                </button>
              </form>
            </div>

            {/* History */}
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Recent history</div>
              {fxHistory.length === 0 ? (
                <div className="text-sm text-gray-400">No history yet</div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                          Pair
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                          Rate
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxHistory.map((s, i) => (
                        <tr
                          key={s.id}
                          className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                        >
                          <td className="px-3 py-2.5 font-medium text-gray-700">
                            {s.fromCurrency}→ARS
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-gray-900">
                            {Number(s.rate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">
                            {new Date(String(s.effectiveDate)).toLocaleDateString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Risk Thresholds */}
      <section>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Risk Thresholds
        </div>
        {riskLoading && <Spinner />}
        {riskError && <ErrorBox message={riskError} onRetry={loadRisks} />}
        {!riskLoading && !riskError && (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {Object.entries(RISK_KEY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1">
                  <div className="text-sm text-gray-700 font-medium">{label}</div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">{key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.01"
                    value={riskEdits[key] ?? String(RISK_DEFAULTS[key])}
                    onChange={(e) =>
                      setRiskEdits((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="w-20 px-2 py-1.5 text-sm font-mono tabular-nums border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 text-right"
                  />
                  <button
                    onClick={() => saveRisk(key)}
                    disabled={riskSaving === key}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {riskSaving === key ? '…' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Goals
          </div>
          <button
            onClick={() => setShowAddGoal(true)}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Add Goal
          </button>
        </div>
        {goalsLoading && <Spinner />}
        {goalsError && <ErrorBox message={goalsError} onRetry={loadGoals} />}
        {!goalsLoading && !goalsError && goals.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">No goals yet</div>
        )}
        {!goalsLoading && !goalsError && goals.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onUpdate={openPatch} />
            ))}
          </div>
        )}
      </section>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <Modal title="Add Goal" onClose={() => setShowAddGoal(false)}>
          <form onSubmit={submitGoal} className="space-y-3.5">
            <div>
              <Label>Name</Label>
              <input
                type="text"
                required
                value={goalForm.name}
                onChange={(e) => setGoalForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Emergency fund"
              />
            </div>
            <div>
              <Label>Target Amount (ARS)</Label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={goalForm.targetArs}
                onChange={(e) => setGoalForm((p) => ({ ...p, targetArs: e.target.value }))}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>
                Target Date <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <input
                type="date"
                value={goalForm.targetDate}
                onChange={(e) => setGoalForm((p) => ({ ...p, targetDate: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <Label>
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <input
                type="text"
                value={goalForm.notes}
                onChange={(e) => setGoalForm((p) => ({ ...p, notes: e.target.value }))}
                className={inputCls}
                placeholder="Optional note"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={goalBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {goalBusy ? 'Adding…' : 'Add Goal'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddGoal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Update Goal Modal */}
      {patchingGoal && (
        <Modal title={`Update — ${patchingGoal.name}`} onClose={() => setPatchingGoal(null)}>
          <form onSubmit={submitPatch} className="space-y-3.5">
            <div>
              <Label>Current Amount (ARS)</Label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={patchForm.currentArs}
                onChange={(e) => setPatchForm((p) => ({ ...p, currentArs: e.target.value }))}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={patchForm.isCompleted}
                onChange={(e) =>
                  setPatchForm((p) => ({ ...p, isCompleted: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Mark as completed</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={patchBusy}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {patchBusy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setPatchingGoal(null)}
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
