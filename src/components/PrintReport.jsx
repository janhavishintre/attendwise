import { formatPercent } from '../utils/attendanceCalculator.js';
import { STATUS_META, needText } from './status.jsx';

/** Only visible when printing (or saving as PDF from the print dialog). */
export default function PrintReport({ summary, target, fileName, student }) {
  const rows = summary.analyzed.filter((s) => s.usable);
  return (
    <div className="hidden p-8 print:block">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">AttendWise - Attendance summary</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generated {new Date().toLocaleString()} - target {target}%{fileName ? ` - source: ${fileName}` : ''}
          </p>
        </div>
        {student && (
          <div className="text-right text-xs text-slate-700">
            {student.name && <p className="font-semibold text-sm text-slate-900">{student.name}</p>}
            <p>{[student.rollNo && `Roll No: ${student.rollNo}`, student.studentNumber && `ID: ${student.studentNumber}`].filter(Boolean).join(' • ')}</p>
            {student.program && <p>{student.program}</p>}
            {student.session && <p>{student.session}</p>}
          </div>
        )}
      </div>
      <p className="mt-4 text-sm">
        Overall: <strong>{formatPercent(summary.overallPercent)}</strong> ({summary.attended} of {summary.total} lectures).{' '}
        {summary.belowCount} subject(s) below target, {summary.meetingCount} meeting target.
      </p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-400 text-left">
            <th className="py-2 pr-2">Subject</th>
            <th className="py-2 pr-2 text-right">Conducted</th>
            <th className="py-2 pr-2 text-right">Attended</th>
            <th className="py-2 pr-2 text-right">Missed</th>
            <th className="py-2 pr-2 text-right">Attendance</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2">To reach {target}%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-slate-200">
              <td className="py-1.5 pr-2">{s.name}{s.code ? ` (${s.code})` : ''}</td>
              <td className="py-1.5 pr-2 text-right">{s.total}</td>
              <td className="py-1.5 pr-2 text-right">{s.attended}</td>
              <td className="py-1.5 pr-2 text-right">{s.missed}</td>
              <td className="py-1.5 pr-2 text-right">{formatPercent(s.percent)}</td>
              <td className="py-1.5 pr-2">{STATUS_META[s.status].label}</td>
              <td className="py-1.5">{needText(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-slate-500">
        Projections only. Overall attendance = total attended ÷ total conducted. Your college's official records and policies apply.
      </p>
    </div>
  );
}
