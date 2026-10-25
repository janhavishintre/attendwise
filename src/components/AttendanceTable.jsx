import { ChevronRight } from 'lucide-react';
import AttendanceProgress from './AttendanceProgress.jsx';
import { StatusBadge, needText, STATUS_META } from './status.jsx';
import { formatPercent } from '../utils/attendanceCalculator.js';

export default function AttendanceTable({ subjects, target, onSelect }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Subject</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Conducted</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Attended</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Missed</th>
              <th scope="col" className="w-44 px-3 py-3 font-medium">Attendance</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
              <th scope="col" className="px-3 py-3 font-medium">To reach {target}%</th>
              <th scope="col" className="w-8 px-2 py-3"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(s.id)}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="max-w-[220px] truncate text-left font-medium text-slate-900 hover:text-brand-700 focus:outline-none focus-visible:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(s.id);
                    }}
                    title={s.name}
                  >
                    {s.name}
                  </button>
                  {s.code && <div className="text-xs text-slate-400">{s.code}</div>}
                  {s.notUpdated > 0 && (
                    <div className="mt-0.5">
                      <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        {s.notUpdated} pending update
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{s.total}</td>
                <td className="px-3 py-3 text-right tabular-nums">{s.attended}</td>
                <td className="px-3 py-3 text-right tabular-nums">{s.missed}</td>
                <td className="px-3 py-3">
                  <AttendanceProgress percent={s.percent} target={target} status={s.status} showValue={false} />
                  <div className={`mt-1 text-xs font-semibold tabular-nums ${STATUS_META[s.status].text}`}>{formatPercent(s.percent)}</div>
                </td>
                <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-3 py-3 text-slate-700">{needText(s)}</td>
                <td className="px-2 py-3 text-slate-300"><ChevronRight className="h-4 w-4" aria-hidden="true" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
