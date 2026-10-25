import { AlertTriangle, ArrowDown, ArrowUp, Info, RotateCcw } from 'lucide-react';
import {
  attendancePercent,
  formatPercent,
  meetsTarget,
  projectedPercent,
  requiredLectures,
} from '../utils/attendanceCalculator.js';

const clampCount = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 0;
};

export default function AttendanceSimulator({ summary, target, plans, onPlansChange }) {
  const subjects = summary.analyzed.filter((s) => s.usable);
  const planFor = (id) => plans[id] || { attend: 0, miss: 0 };

  const setPlan = (id, patch) => {
    const next = { ...planFor(id), ...patch };
    const copy = { ...plans };
    if (next.attend === 0 && next.miss === 0) delete copy[id];
    else copy[id] = next;
    onPlansChange(copy);
  };

  const totals = subjects.reduce(
    (acc, s) => {
      const p = planFor(s.id);
      acc.attended += s.attended + p.attend;
      acc.total += s.total + p.attend + p.miss;
      return acc;
    },
    { attended: 0, total: 0 },
  );
  const overallProjected = attendancePercent(totals.attended, totals.total);
  const anyPlan = Object.keys(plans).length > 0;

  if (subjects.length === 0) {
    return <div className="card p-8 text-center text-sm text-slate-500">Add subjects with at least one conducted lecture to use the simulator.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          These are <strong>projections</strong>, not predictions. Enter how many upcoming lectures you plan to attend or might miss in each subject. Actual college rules (condonation, medical leave, how lectures are counted) may differ.
        </p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">Projected overall attendance</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{formatPercent(overallProjected)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Now {formatPercent(summary.overallPercent)} - {totals.attended} / {totals.total} lectures after your plan
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!meetsTarget(totals.attended, totals.total, target) && anyPlan && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Overall below {target}%
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={() => onPlansChange({})} disabled={!anyPlan}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset all
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {subjects.map((s) => {
          const p = planFor(s.id);
          const projected = projectedPercent(s.attended, s.total, p.attend, p.miss);
          const hasPlan = p.attend > 0 || p.miss > 0;
          const projectedMeets = meetsTarget(s.attended + p.attend, s.total + p.attend + p.miss, target);
          const delta = projected - s.percent;
          const stillNeeded = requiredLectures(s.attended + p.attend, s.total + p.attend + p.miss, target);
          const warn = hasPlan && !projectedMeets;
          return (
            <div key={s.id} className={`card p-4 sm:p-5 ${warn ? 'border-red-200' : ''}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 lg:w-1/4">
                  <h3 className="truncate text-sm font-semibold text-slate-900" title={s.name}>{s.name}</h3>
                  <p className="text-xs text-slate-500">
                    {s.attended} / {s.total} - {formatPercent(s.percent)} now
                  </p>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-3 lg:max-w-sm">
                  <label className="text-xs font-medium text-slate-500">
                    Will attend
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className="input mt-1"
                      value={p.attend === 0 ? '' : p.attend}
                      placeholder="0"
                      onChange={(e) => setPlan(s.id, { attend: clampCount(e.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Might miss
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className="input mt-1"
                      value={p.miss === 0 ? '' : p.miss}
                      placeholder="0"
                      onChange={(e) => setPlan(s.id, { miss: clampCount(e.target.value) })}
                    />
                  </label>
                </div>

                <div className="lg:ml-auto lg:w-56 lg:text-right">
                  <p className="text-xs text-slate-500">Projected</p>
                  <p className={`text-2xl font-bold tabular-nums ${!hasPlan ? 'text-slate-400' : projectedMeets ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPercent(projected)}
                  </p>
                  {hasPlan && (
                    <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {delta >= 0 ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                      {Math.abs(roundTwo(delta)).toFixed(2)} points
                    </p>
                  )}
                </div>
              </div>

              {warn && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {Number.isFinite(stillNeeded)
                    ? `Projected attendance falls below ${target}%. You would still need to attend ${stillNeeded} more lecture${stillNeeded === 1 ? '' : 's'} in a row afterwards.`
                    : `Projected attendance falls below ${target}% and the target could not be reached again.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function roundTwo(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
