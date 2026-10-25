import { describe, expect, it } from 'vitest';
import {
  analyzeSubject,
  attendancePercent,
  filterSubjects,
  formatPercent,
  maxMissable,
  meetsTarget,
  normalizeTarget,
  projectedPercent,
  requiredLectures,
  sortSubjects,
  STATUS,
  summarize,
  validateSubject,
} from './attendanceCalculator.js';

describe('requiredLectures (75% target)', () => {
  it('matches the worked example: 30/50 needs 30 more lectures', () => {
    expect(attendancePercent(30, 50)).toBe(60);
    expect(requiredLectures(30, 50, 75)).toBe(30);
    // 60 / 80 = 75%
    expect(attendancePercent(30 + 30, 50 + 30)).toBe(75);
  });

  it('is zero when already at or above the target', () => {
    expect(requiredLectures(75, 100, 75)).toBe(0);
    expect(requiredLectures(90, 100, 75)).toBe(0);
    expect(requiredLectures(10, 10, 75)).toBe(0);
  });

  it('rounds up to the next whole lecture', () => {
    // 20/30: (0.75*30 - 20)/0.25 = 10 exactly
    expect(requiredLectures(20, 30, 75)).toBe(10);
    // 21/31: (23.25 - 21)/0.25 = 9
    expect(requiredLectures(21, 31, 75)).toBe(9);
    // 22/33: (24.75 - 22)/0.25 = 11
    expect(requiredLectures(22, 33, 75)).toBe(11);
    // 0/1: (0.75 - 0)/0.25 = 3
    expect(requiredLectures(0, 1, 75)).toBe(3);
  });

  it('handles zero lectures safely', () => {
    expect(requiredLectures(0, 0, 75)).toBe(0);
    expect(attendancePercent(0, 0)).toBe(0);
    expect(maxMissable(0, 0, 75)).toBe(0);
  });

  it('is exactly minimal for every small case and several targets', () => {
    for (const target of [50, 60, 65, 70, 72.5, 75, 80, 85, 90]) {
      for (let total = 0; total <= 60; total += 1) {
        for (let attended = 0; attended <= total; attended += 1) {
          const x = requiredLectures(attended, total, target);
          // x lectures are enough...
          expect(meetsTarget(attended + x, total + x, target) || total + x === 0).toBe(true);
          // ...and x - 1 is not (minimality).
          if (x > 0) {
            expect(meetsTarget(attended + x - 1, total + x - 1, target)).toBe(false);
          }
        }
      }
    }
  });

  it('target of 100% is impossible once a lecture has been missed', () => {
    expect(requiredLectures(9, 10, 100)).toBe(Infinity);
    expect(requiredLectures(10, 10, 100)).toBe(0);
  });

  it('ignores invalid input instead of returning nonsense', () => {
    expect(requiredLectures(11, 10, 75)).toBe(0);
    expect(requiredLectures(-1, 10, 75)).toBe(0);
    expect(requiredLectures(1.5, 10, 75)).toBe(0);
  });
});

describe('maxMissable', () => {
  it('computes how many lectures can be skipped while staying at 75%', () => {
    // 80/100: floor((80 - 75)/0.75) = 6  -> 80/106 = 75.47%, 80/107 = 74.77%
    expect(maxMissable(80, 100, 75)).toBe(6);
    expect(meetsTarget(80, 106, 75)).toBe(true);
    expect(meetsTarget(80, 107, 75)).toBe(false);
  });

  it('is zero when exactly at or below the target', () => {
    expect(maxMissable(75, 100, 75)).toBe(0);
    expect(maxMissable(60, 100, 75)).toBe(0);
  });

  it('is the true maximum for every small case', () => {
    for (const target of [50, 75, 80]) {
      for (let total = 1; total <= 50; total += 1) {
        for (let attended = 0; attended <= total; attended += 1) {
          if (!meetsTarget(attended, total, target)) continue;
          const m = maxMissable(attended, total, target);
          expect(meetsTarget(attended, total + m, target)).toBe(true);
          expect(meetsTarget(attended, total + m + 1, target)).toBe(false);
        }
      }
    }
  });
});

describe('projections and formatting', () => {
  it('projects attendance after attending and missing future lectures', () => {
    expect(projectedPercent(30, 50, 30, 0)).toBe(75);
    // 30/50 + attend 10, miss 10 -> 40/70
    expect(projectedPercent(30, 50, 10, 10)).toBeCloseTo((40 / 70) * 100, 10);
    expect(projectedPercent(0, 0, 0, 0)).toBe(0);
  });

  it('rounds for display to two decimals only', () => {
    expect(formatPercent(66.666666)).toBe('66.67%');
    expect(formatPercent(75)).toBe('75.00%');
    expect(formatPercent(Number.NaN)).toBe('-');
  });

  it('uses unrounded values for the target check', () => {
    // 74.996% displays as 75.00% but must NOT count as meeting 75%.
    expect(formatPercent(attendancePercent(7499, 10000 - 1 + 1 - 0))).toBe('74.99%');
    expect(meetsTarget(7499, 10000, 75)).toBe(false);
    expect(meetsTarget(7500, 10000, 75)).toBe(true);
  });

  it('normalises the target', () => {
    expect(normalizeTarget('80')).toBe(80);
    expect(normalizeTarget(150)).toBe(100);
    expect(normalizeTarget(-5)).toBe(1);
    expect(normalizeTarget('abc')).toBe(75);
  });
});

describe('validation', () => {
  it('flags missing name, negative, fractional and over-attended values', () => {
    expect(validateSubject({ name: '', attended: 5, total: 10 }).errors.name).toBeTruthy();
    expect(validateSubject({ name: 'X', attended: -1, total: 10 }).errors.attended).toBeTruthy();
    expect(validateSubject({ name: 'X', attended: 1.5, total: 10 }).errors.attended).toBeTruthy();
    expect(validateSubject({ name: 'X', attended: 11, total: 10 }).errors.attended).toMatch(/more than total/);
    expect(validateSubject({ name: 'X', attended: null, total: 10 }).errors.attended).toBeTruthy();
    expect(validateSubject({ name: 'X', attended: 5, total: null }).errors.total).toBeTruthy();
    expect(validateSubject({ name: 'X', attended: 5, total: 10 }).valid).toBe(true);
  });

  it('warns about zero total lectures without treating it as an error', () => {
    const v = validateSubject({ name: 'X', attended: 0, total: 0 });
    expect(v.valid).toBe(true);
    expect(v.warnings.total).toBeTruthy();
  });
});

describe('analyzeSubject statuses', () => {
  it('classifies below / reached / safe / no-data', () => {
    expect(analyzeSubject({ name: 'A', attended: 30, total: 50 }, 75).status).toBe(STATUS.BELOW);
    expect(analyzeSubject({ name: 'B', attended: 75, total: 100 }, 75).status).toBe(STATUS.REACHED);
    expect(analyzeSubject({ name: 'C', attended: 90, total: 100 }, 75).status).toBe(STATUS.SAFE);
    expect(analyzeSubject({ name: 'D', attended: 0, total: 0 }, 75).status).toBe(STATUS.NO_DATA);
    expect(analyzeSubject({ name: 'E', attended: 12, total: 10 }, 75).usable).toBe(false);
  });

  it('recalculates when the target changes', () => {
    const s = { name: 'A', attended: 80, total: 100 };
    expect(analyzeSubject(s, 75).status).toBe(STATUS.SAFE);
    expect(analyzeSubject(s, 85).status).toBe(STATUS.BELOW);
    expect(analyzeSubject(s, 85).required).toBe(Math.ceil((0.85 * 100 - 80) / 0.15));
  });

  it('reports the working after attending the required lectures', () => {
    const r = analyzeSubject({ name: 'A', attended: 30, total: 50 }, 75);
    expect(r.afterRequired).toEqual({ attended: 60, total: 80 });
    expect(r.missed).toBe(20);
  });
});

describe('summarize', () => {
  const subjects = [
    { id: '1', name: 'Maths', attended: 30, total: 50 },
    { id: '2', name: 'Physics', attended: 90, total: 100 },
    { id: '3', name: 'Lab', attended: 0, total: 0 },
    { id: '4', name: 'Broken', attended: 20, total: 10 },
  ];

  it('overall = sum(attended)/sum(total), not the mean of percentages', () => {
    const s = summarize(subjects, 75);
    expect(s.attended).toBe(120);
    expect(s.total).toBe(150);
    expect(s.overallPercent).toBe(80);
    expect(s.averageOfSubjects).toBe(75); // (60 + 90) / 2 - a different number, labelled separately
    expect(s.belowCount).toBe(1);
    expect(s.meetingCount).toBe(1);
    expect(s.usableCount).toBe(2);
  });

  it('handles an empty list', () => {
    const s = summarize([], 75);
    expect(s.overallPercent).toBe(0);
    expect(s.total).toBe(0);
  });
});

describe('sorting and filtering', () => {
  const analyzed = summarize(
    [
      { id: '1', name: 'Zoology', attended: 30, total: 50 },
      { id: '2', name: 'Algebra', attended: 90, total: 100 },
      { id: '3', name: 'Botany', attended: 55, total: 100 },
      { id: '4', name: 'Empty', attended: 0, total: 0 },
    ],
    75,
  ).analyzed;

  it('sorts by lowest, highest, most needed and name', () => {
    expect(sortSubjects(analyzed, 'lowest').map((s) => s.name)).toEqual(['Botany', 'Zoology', 'Algebra', 'Empty']);
    expect(sortSubjects(analyzed, 'highest').map((s) => s.name)).toEqual(['Algebra', 'Zoology', 'Botany', 'Empty']);
    // Botany 55/100 needs 80 more; Zoology 30/50 needs 30 more
    expect(sortSubjects(analyzed, 'needed').map((s) => s.name).slice(0, 2)).toEqual(['Botany', 'Zoology']);
    expect(sortSubjects(analyzed, 'name').map((s) => s.name)).toEqual(['Algebra', 'Botany', 'Empty', 'Zoology']);
  });

  it('filters by target status', () => {
    expect(filterSubjects(analyzed, 'below').map((s) => s.name).sort()).toEqual(['Botany', 'Zoology']);
    expect(filterSubjects(analyzed, 'meeting').map((s) => s.name)).toEqual(['Algebra']);
    expect(filterSubjects(analyzed, 'all')).toHaveLength(4);
  });
});
