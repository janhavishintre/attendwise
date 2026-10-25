import { useEffect } from 'react';
import { X } from 'lucide-react';
import AttendanceProgress from './AttendanceProgress.jsx';
import { StatusBadge, STATUS_META } from './status.jsx';
import { formatPercent, STATUS } from '../utils/attendanceCalculator.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000));

function Step({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

export default function SubjectDetail({ subject, target, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!subject) return null;
  const P = target / 100;
  const { attended: A, total: T } = subject;
  const meta = STATUS_META[subject.status];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${subject.name} details`}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close details" />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{subject.name}</h2>
            {subject.code && <p className="text-sm text-slate-400">{subject.code}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <StatusBadge status={subject.status} />
          <span className="text-sm text-slate-500">Target {target}%</span>
        </div>
        <AttendanceProgress className="mt-3" percent={subject.percent} target={target} status={subject.status} />

        {!subject.usable ? (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No lectures have been conducted for this subject yet, so there is nothing to calculate.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <Step title="1. Current attendance">
              <p>Attended ÷ Conducted = {A} ÷ {T}</p>
              <p className="font-semibold text-slate-900">= {formatPercent(subject.percent)}</p>
              <p className="text-xs text-slate-500">{subject.missed} lectures missed.</p>
              {subject.notUpdated > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {subject.notUpdated} lecture{subject.notUpdated > 1 ? 's are' : ' is'} not updated yet (not counted in conducted).
                </p>
              )}
            </Step>

            {subject.status === STATUS.BELOW ? (
              Number.isFinite(subject.required) ? (
                <>
                  <Step title={`2. Lectures needed to reach ${target}%`}>
                    <p>Each attended lecture adds 1 to both attended <em>and</em> conducted, so the total grows too:</p>
                    <p className="font-mono text-xs sm:text-sm">x = ceil((P × T − A) ÷ (1 − P))</p>
                    <p className="font-mono text-xs sm:text-sm">
                      x = ceil(({fmt(P)} × {T} − {A}) ÷ {fmt(1 - P)}) = ceil({fmt((P * T - A) / (1 - P))})
                    </p>
                    <p className="font-semibold text-slate-900">= {subject.required} lectures in a row</p>
                  </Step>
                  <Step title="3. Check">
                    <p>
                      ({A} + {subject.required}) ÷ ({T} + {subject.required}) = {subject.afterRequired.attended} ÷ {subject.afterRequired.total} ={' '}
                      <span className="font-semibold text-slate-900">
                        {formatPercent((subject.afterRequired.attended / subject.afterRequired.total) * 100)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      One fewer lecture ({subject.required - 1}) would give{' '}
                      {formatPercent(((A + subject.required - 1) / (T + subject.required - 1)) * 100)}, which is still below {target}%.
                    </p>
                  </Step>
                </>
              ) : (
                <Step title="2. Target not reachable">
                  <p>A target of 100% cannot be reached once a lecture has been missed.</p>
                </Step>
              )
            ) : (
              <>
                <Step title="2. Target met">
                  <p className={meta.text}>
                    {formatPercent(subject.percent)} is at or above {target}%. No extra lectures are required right now.
                  </p>
                </Step>
                <Step title="3. How many lectures can you still miss?">
                  <p>If you attend none of the next m lectures:</p>
                  <p className="font-mono text-xs sm:text-sm">m = floor((A − P × T) ÷ P)</p>
                  <p className="font-mono text-xs sm:text-sm">
                    m = floor(({A} − {fmt(P)} × {T}) ÷ {fmt(P)}) = floor({fmt((A - P * T) / P)})
                  </p>
                  <p className="font-semibold text-slate-900">= {subject.canMiss} lecture{subject.canMiss === 1 ? '' : 's'}</p>
                  <p className="text-xs text-slate-500">
                    After missing {subject.canMiss}: {A} ÷ {T + subject.canMiss} = {formatPercent((A / (T + subject.canMiss)) * 100)}. Missing one more would drop below {target}%.
                  </p>
                </Step>
              </>
            )}
          </div>
        )}

        <p className="mt-5 text-xs text-slate-400">Projections assume the numbers on file are correct. Your college's official policy may differ.</p>
      </div>
    </div>
  );
}
