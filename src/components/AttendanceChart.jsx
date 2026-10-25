import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPercent } from '../utils/attendanceCalculator.js';

const truncate = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{d.fullName}</p>
      <p className="mt-0.5 text-slate-600">
        {formatPercent(d.percent)} - {d.attended} of {d.total} lectures
      </p>
    </div>
  );
}

/** Single-series bar chart of attendance per subject with the target as a reference line. */
export default function AttendanceChart({ subjects, target }) {
  const data = subjects
    .filter((s) => s.usable)
    .map((s) => ({
      name: truncate(s.name, 14),
      fullName: s.name,
      percent: Math.round(s.percent * 100) / 100,
      attended: s.attended,
      total: s.total,
    }));
  if (data.length === 0) return null;

  return (
    <section className="card p-5" aria-label="Attendance by subject chart">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Attendance by subject</h2>
        <p className="text-xs text-slate-500">Dashed line = {target}% target. Full figures are in the table below.</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={data.length > 5 ? -25 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 56 : 30} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <ReferenceLine y={target} stroke="#334155" strokeDasharray="5 4" strokeWidth={1.5} />
            <Bar dataKey="percent" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
