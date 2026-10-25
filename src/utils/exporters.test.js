import { describe, expect, it } from 'vitest';
import { summarize } from './attendanceCalculator.js';
import { buildCsv } from './exporters.js';

describe('buildCsv', () => {
  it('exports subjects and an overall row, quoting and neutralising formulas', () => {
    const summary = summarize(
      [
        { id: '1', name: 'Maths, Advanced', code: 'MA1', attended: 30, total: 50 },
        { id: '2', name: '=HYPERLINK("http://x")', attended: 9, total: 10 },
      ],
      75,
    );
    const csv = buildCsv(summary, 75);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Subject,Code,Total lectures');
    expect(lines[1]).toBe('"Maths, Advanced",MA1,50,30,20,60.00,75,Below target,30,0');
    expect(lines[2].startsWith("\"'=HYPERLINK")).toBe(true);
    expect(lines[3]).toContain('OVERALL');
    expect(lines[3]).toContain('65.00'); // 39 / 60, not the mean of 60 and 90
  });
});
