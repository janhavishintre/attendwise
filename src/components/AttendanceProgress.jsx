import { STATUS_META } from './status.jsx';
import { formatPercent } from '../utils/attendanceCalculator.js';

/** Progress bar with a tick marking the target. */
export default function AttendanceProgress({ percent, target, status, showValue = true, className = '' }) {
  const meta = STATUS_META[status] ?? STATUS_META['no-data'];
  const width = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className={className}>
      {showValue && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className={`text-sm font-semibold ${meta.text}`}>{formatPercent(percent || 0)}</span>
          <span className="text-slate-400">target {target}%</span>
        </div>
      )}
      <div
        className="relative h-2.5 w-full rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={`Attendance ${formatPercent(percent || 0)}, target ${target}%`}
      >
        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${width}%` }} />
        <div
          className="absolute -top-1 h-4.5 w-0.5 bg-slate-700"
          style={{ left: `calc(${Math.min(100, target)}% - 1px)`, height: '18px' }}
          title={`Target ${target}%`}
        />
      </div>
    </div>
  );
}
