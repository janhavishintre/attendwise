import { useEffect, useState } from 'react';
import { Database, Info, Trash2 } from 'lucide-react';
import { MAX_TARGET, MIN_TARGET, normalizeTarget } from '../utils/attendanceCalculator.js';

/** Compact target-percentage control used in the header and on the settings page. */
export function TargetInput({ target, onChange, id = 'target-input', compact = false }) {
  const [text, setText] = useState(String(target));

  useEffect(() => {
    setText(String(target));
  }, [target]);

  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) {
      setText(String(target));
      return;
    }
    const next = normalizeTarget(n);
    setText(String(next));
    if (next !== target) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={compact ? 'sr-only sm:not-sr-only text-xs font-medium text-slate-500' : 'text-sm font-medium text-slate-700'}>
        Target
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={MIN_TARGET}
          max={MAX_TARGET}
          step="0.5"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= MIN_TARGET && n <= MAX_TARGET) onChange(normalizeTarget(n));
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="input w-24 pr-7 text-right"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}

export default function AttendanceSettings({ target, onTargetChange, onClear, hasData, updatedAt, fileName }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card p-6">
        <h2 className="text-base font-semibold text-slate-900">Minimum attendance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every calculation is redone as soon as you change this. Most colleges use 75%, but some use 70%, 80% or a different value per course.
        </p>
        <div className="mt-4">
          <TargetInput target={target} onChange={onTargetChange} id="settings-target" />
          <div className="mt-3 flex flex-wrap gap-2">
            {[60, 70, 75, 80, 85].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onTargetChange(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                  target === p ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Saved data</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your subjects and settings are kept only in this browser (local storage). PDFs are read on your device and are never uploaded.
            </p>
            {hasData && (
              <p className="mt-2 text-xs text-slate-400">
                {fileName ? `Source: ${fileName}. ` : ''}
                {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}.` : ''}
              </p>
            )}
            <div className="mt-4">
              {!confirming ? (
                <button type="button" className="btn-danger" onClick={() => setConfirming(true)} disabled={!hasData}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear saved data
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <span className="text-sm text-red-800">Delete all subjects and simulator plans from this browser?</span>
                  <button
                    type="button"
                    className="btn bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      onClear();
                      setConfirming(false);
                    }}
                  >
                    Yes, delete
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card flex items-start gap-3 p-6">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-sm text-slate-500">
          AttendWise is a planning aid. Results are projections based on the numbers you confirm; your college's official records and policies (condonation, medical leave, per-subject rules) always take priority.
        </p>
      </section>
    </div>
  );
}
