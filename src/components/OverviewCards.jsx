import { AlertCircle, BookOpenCheck, CheckCircle2, Percent } from 'lucide-react';
import { formatPercent } from '../utils/attendanceCalculator.js';

function Card({ icon: Icon, tone, label, value, children }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <div className="mt-1 text-xs text-slate-500">{children}</div>
    </div>
  );
}

export default function OverviewCards({ summary, target }) {
  const overallMeets = summary.total > 0 && summary.overallPercent >= target && summary.overallRequired === 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card icon={Percent} tone="brand" label="Overall attendance" value={summary.total > 0 ? formatPercent(summary.overallPercent) : '-'}>
        <p>
          {summary.total === 0
            ? 'No lectures yet'
            : overallMeets
              ? `Meets the ${target}% target`
              : Number.isFinite(summary.overallRequired)
                ? `${summary.overallRequired} more lectures to reach ${target}% overall`
                : `${target}% overall is no longer reachable`}
        </p>
        <p className="mt-0.5 text-slate-400">All lectures combined (not an average of subject percentages)</p>
      </Card>

      <Card icon={BookOpenCheck} tone="blue" label="Lectures attended" value={`${summary.attended} / ${summary.total}`}>
        <p>{summary.missed} missed across {summary.usableCount} subject{summary.usableCount === 1 ? '' : 's'}</p>
        {summary.usableCount > 0 && (
          <p className="mt-0.5 text-slate-400">Average of subject percentages: {formatPercent(summary.averageOfSubjects)}</p>
        )}
      </Card>

      <Card icon={AlertCircle} tone="red" label={`Below ${target}%`} value={summary.belowCount}>
        <p>{summary.belowCount === 0 ? 'No subject is below target' : 'Subjects that need attention'}</p>
      </Card>

      <Card icon={CheckCircle2} tone="green" label="Meeting target" value={summary.meetingCount}>
        <p>{summary.meetingCount === 0 ? 'No subject meets the target yet' : `Subjects at or above ${target}%`}</p>
      </Card>
    </div>
  );
}
