/**
 * Attendance calculation utilities.
 *
 * All "how many lectures" maths is done with exact integer arithmetic so that
 * floating point error can never make the result off by one. The target
 * percentage is scaled to hundredths of a percent (75 -> 7500) and every
 * comparison is done on integers.
 *
 *   Required lectures x (smallest x >= 0) such that
 *     (A + x) / (T + x) >= P
 *   =>  x >= (P*T - A) / (1 - P)        <- the denominator grows with x
 *   =>  x = max(0, ceil((P*T - A) / (1 - P)))
 *
 *   Lectures that can be missed m (largest m >= 0) such that
 *     A / (T + m) >= P
 *   =>  m = floor((A - P*T) / P)
 */

export const DEFAULT_TARGET = 75;
export const MIN_TARGET = 1;
export const MAX_TARGET = 100;

/** Scale a percentage (e.g. 75 or 72.5) to integer hundredths of a percent. */
const scale = (percent) => Math.round(percent * 100);
const FULL = 10000; // 100.00% in hundredths

const isWholeNumber = (n) => typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);

/** Integer ceiling division for a non-negative numerator and positive denominator. */
function ceilDiv(num, den) {
  let q = Math.floor(num / den);
  while (q * den < num) q += 1;
  while (q > 0 && (q - 1) * den >= num) q -= 1;
  return q;
}

/** Integer floor division for a non-negative numerator and positive denominator. */
function floorDiv(num, den) {
  let q = Math.floor(num / den);
  while ((q + 1) * den <= num) q += 1;
  while (q * den > num) q -= 1;
  return q;
}

/** Clamp / sanitise a target percentage. Falls back to the default for junk input. */
export function normalizeTarget(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TARGET;
  const clamped = Math.min(MAX_TARGET, Math.max(MIN_TARGET, n));
  return Math.round(clamped * 100) / 100;
}

/** Percentage (0-100) as an unrounded number. Zero lectures -> 0. */
export function attendancePercent(attended, total) {
  if (!(total > 0)) return 0;
  return (attended / total) * 100;
}

/** Round for display only - never feed the result back into calculations. */
export function roundPercent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '-';
  return `${roundPercent(value).toFixed(2)}%`;
}

/**
 * Minimum number of consecutive lectures that must be attended (without
 * missing any) for attendance to reach `targetPercent`.
 *
 * Returns 0 when already at/above target, and Infinity when the target is
 * 100% but the student has already missed a lecture (it can never be reached).
 */
export function requiredLectures(attended, total, targetPercent = DEFAULT_TARGET) {
  if (!isWholeNumber(attended) || !isWholeNumber(total) || attended < 0 || total < 0 || attended > total) {
    return 0;
  }
  const p = scale(normalizeTarget(targetPercent));
  const num = p * total - FULL * attended; // P*T - A, scaled
  if (num <= 0) return 0;
  const den = FULL - p; // 1 - P, scaled
  if (den <= 0) return Infinity;
  return ceilDiv(num, den);
}

/**
 * Largest number of upcoming lectures that can be missed (all of them in a
 * row) while attendance stays at or above the target. 0 if already below.
 */
export function maxMissable(attended, total, targetPercent = DEFAULT_TARGET) {
  if (!isWholeNumber(attended) || !isWholeNumber(total) || attended < 0 || total < 0 || attended > total) {
    return 0;
  }
  const p = scale(normalizeTarget(targetPercent));
  const num = FULL * attended - p * total; // A - P*T, scaled
  if (num < 0) return 0;
  return floorDiv(num, p);
}

/** Projected percentage after attending `attend` and missing `miss` more lectures. */
export function projectedPercent(attended, total, attend = 0, miss = 0) {
  const a = Math.max(0, Math.floor(Number(attend) || 0));
  const m = Math.max(0, Math.floor(Number(miss) || 0));
  return attendancePercent(attended + a, total + a + m);
}

/** True when attended/total meets the target, using exact integer comparison. */
export function meetsTarget(attended, total, targetPercent = DEFAULT_TARGET) {
  if (!(total > 0)) return false;
  return FULL * attended >= scale(normalizeTarget(targetPercent)) * total;
}

/** Validate a single subject row. Returns field-level errors and warnings. */
export function validateSubject(subject) {
  const errors = {};
  const warnings = {};
  const name = String(subject?.name ?? '').trim();
  const { attended, total } = subject ?? {};

  if (!name) errors.name = 'Subject name is missing.';

  if (attended === null || attended === undefined || attended === '') {
    errors.attended = 'Attended lectures is missing.';
  } else if (!isWholeNumber(attended)) {
    errors.attended = 'Must be a whole number.';
  } else if (attended < 0) {
    errors.attended = 'Cannot be negative.';
  }

  if (total === null || total === undefined || total === '') {
    errors.total = 'Total lectures is missing.';
  } else if (!isWholeNumber(total)) {
    errors.total = 'Must be a whole number.';
  } else if (total < 0) {
    errors.total = 'Cannot be negative.';
  }

  if (!errors.attended && !errors.total && attended > total) {
    errors.attended = 'Attended cannot be more than total lectures.';
  }
  if (!errors.attended && !errors.total && total === 0) {
    warnings.total = 'No lectures conducted yet - excluded from percentages.';
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

export function hasErrors(validation) {
  return Object.keys(validation.errors).length > 0;
}

export const STATUS = {
  BELOW: 'below',
  REACHED: 'reached',
  SAFE: 'safe',
  NO_DATA: 'no-data',
};

/** Full set of derived metrics for one subject. */
export function analyzeSubject(subject, targetPercent = DEFAULT_TARGET) {
  const validation = validateSubject(subject);
  const attended = subject.attended;
  const total = subject.total;

  if (!validation.valid) {
    return { ...subject, validation, usable: false, status: STATUS.NO_DATA };
  }

  const missed = total - attended;
  const percent = attendancePercent(attended, total);
  const required = total > 0 ? requiredLectures(attended, total, targetPercent) : 0;
  const canMiss = total > 0 ? maxMissable(attended, total, targetPercent) : 0;
  const meets = meetsTarget(attended, total, targetPercent);

  let status = STATUS.NO_DATA;
  if (total > 0) {
    if (!meets) status = STATUS.BELOW;
    else if (canMiss === 0) status = STATUS.REACHED;
    else status = STATUS.SAFE;
  }

  return {
    ...subject,
    validation,
    usable: total > 0,
    missed,
    percent,
    required,
    canMiss,
    meets,
    status,
    // Attendance if the student attends exactly the required lectures, for display of the working.
    afterRequired:
      Number.isFinite(required) && total > 0
        ? { attended: attended + required, total: total + required }
        : null,
  };
}

/** Summary across subjects: overall = sum(attended) / sum(total), never an average of percentages. */
export function summarize(subjects, targetPercent = DEFAULT_TARGET) {
  const analyzed = subjects.map((s) => analyzeSubject(s, targetPercent));
  const usable = analyzed.filter((s) => s.usable);

  const attended = usable.reduce((sum, s) => sum + s.attended, 0);
  const total = usable.reduce((sum, s) => sum + s.total, 0);
  const overallPercent = attendancePercent(attended, total);
  const averageOfSubjects = usable.length
    ? usable.reduce((sum, s) => sum + s.percent, 0) / usable.length
    : 0;

  return {
    analyzed,
    usableCount: usable.length,
    attended,
    total,
    missed: total - attended,
    overallPercent,
    averageOfSubjects,
    overallRequired: total > 0 ? requiredLectures(attended, total, targetPercent) : 0,
    overallCanMiss: total > 0 ? maxMissable(attended, total, targetPercent) : 0,
    belowCount: usable.filter((s) => !s.meets).length,
    meetingCount: usable.filter((s) => s.meets).length,
  };
}

export const SORT_OPTIONS = [
  { value: 'lowest', label: 'Lowest attendance' },
  { value: 'highest', label: 'Highest attendance' },
  { value: 'needed', label: 'Most lectures needed' },
  { value: 'name', label: 'Subject name' },
];

export const FILTER_OPTIONS = [
  { value: 'all', label: 'All subjects' },
  { value: 'below', label: 'Below target' },
  { value: 'meeting', label: 'Meeting target' },
];

export function filterSubjects(analyzed, filter) {
  if (filter === 'below') return analyzed.filter((s) => s.usable && !s.meets);
  if (filter === 'meeting') return analyzed.filter((s) => s.usable && s.meets);
  return analyzed;
}

export function sortSubjects(analyzed, sortBy) {
  const list = [...analyzed];
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  // Subjects without usable data always sink to the bottom for numeric sorts.
  const numeric = (getter, direction) => (a, b) => {
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    const diff = direction * (getter(a) - getter(b));
    if (Number.isNaN(diff) || diff === 0) return byName(a, b);
    return diff;
  };
  switch (sortBy) {
    case 'highest':
      return list.sort(numeric((s) => s.percent ?? 0, -1));
    case 'needed':
      // Infinity - Infinity is NaN, which falls through to the name tie-break.
      return list.sort(numeric((s) => s.required ?? 0, -1));
    case 'name':
      return list.sort(byName);
    case 'lowest':
    default:
      return list.sort(numeric((s) => s.percent ?? 0, 1));
  }
}
