import { AlertCircle, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import { STATUS } from '../utils/attendanceCalculator.js';

// Full class names are listed explicitly so Tailwind can see them.
export const STATUS_META = {
  [STATUS.BELOW]: {
    label: 'Below target',
    Icon: AlertCircle,
    badge: 'bg-red-50 text-red-700 ring-red-200',
    bar: 'bg-red-500',
    text: 'text-red-600',
    panel: 'border-red-200 bg-red-50 text-red-800',
  },
  [STATUS.REACHED]: {
    label: 'At target',
    Icon: AlertTriangle,
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    bar: 'bg-amber-500',
    text: 'text-amber-600',
    panel: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  [STATUS.SAFE]: {
    label: 'Safe',
    Icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  [STATUS.NO_DATA]: {
    label: 'No data',
    Icon: MinusCircle,
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    bar: 'bg-slate-300',
    text: 'text-slate-500',
    panel: 'border-slate-200 bg-slate-50 text-slate-700',
  },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META[STATUS.NO_DATA];
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Short plain-language sentence describing what a subject needs. */
export function needText(subject) {
  if (!subject.usable) return 'No lectures conducted yet';
  if (!subject.meets) {
    return Number.isFinite(subject.required)
      ? `Attend ${subject.required} more in a row`
      : 'Target can no longer be reached';
  }
  if (subject.canMiss === 0) return 'On target - cannot miss any';
  return `Can miss ${subject.canMiss} more`;
}
