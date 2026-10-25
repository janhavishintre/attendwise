import AttendanceProgress from './AttendanceProgress.jsx';
import { StatusBadge, needText, STATUS_META } from './status.jsx';

export default function SubjectCard({ subject, target, onSelect }) {
  const meta = STATUS_META[subject.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(subject.id)}
      className="card w-full p-5 text-left transition hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900" title={subject.name}>
            {subject.name}
          </h3>
          {subject.code && <p className="text-xs text-slate-400">{subject.code}</p>}
        </div>
        <StatusBadge status={subject.status} />
      </div>

      <AttendanceProgress className="mt-4" percent={subject.percent} target={target} status={subject.status} />

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Conducted', subject.total],
          ['Attended', subject.attended],
          ['Missed', subject.missed],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="text-sm font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>

      <p className={`mt-4 text-sm font-medium ${meta.text}`}>{needText(subject)}</p>
      {subject.notUpdated > 0 && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {subject.notUpdated} lecture{subject.notUpdated > 1 ? 's' : ''} pending status update
        </p>
      )}
    </button>
  );
}
