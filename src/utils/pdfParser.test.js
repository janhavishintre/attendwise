import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractLinesFromData,
  interpretNumbers,
  parseAttendanceLines,
  PdfParseError,
} from './pdfParser.js';

const sampleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sample-data');
const lines = (...rows) => rows.map((cells, i) => ({ page: 1, cells: Array.isArray(cells) ? cells : [cells], i }));

describe('interpretNumbers', () => {
  const t = (...vals) =>
    vals.map((v) => {
      const s = String(v);
      return { raw: s, value: Number(s.replace('%', '')), isPct: s.includes('.') || s.endsWith('%'), isInt: /^\d+$/.test(s) };
    });

  it('finds total/attended/missed/% regardless of column order', () => {
    const r = interpretNumbers(t(45, 40, 5, '88.89'));
    expect(r).toMatchObject({ total: 45, attended: 40, reportedMissed: 5, confidence: 'high' });
    const swapped = interpretNumbers(t(40, 45, '88.89', 5));
    expect(swapped).toMatchObject({ total: 45, attended: 40, confidence: 'high' });
  });

  it('flags low confidence when nothing corroborates the two numbers', () => {
    const r = interpretNumbers(t(50, 30));
    expect(r.confidence).toBe('low');
    expect(r.total).toBe(50);
    expect(r.attended).toBe(30);
    expect(r.fieldFlags.total).toBe(true);
  });

  it('uses header order when it is consistent', () => {
    const r = interpretNumbers(t(30, 50), ['attended', 'total']);
    expect(r.attended).toBe(30);
    expect(r.total).toBe(50);
    expect(r.confidence).toBe('medium'); // consistent but not cross-checked
  });
});

describe('parseAttendanceLines', () => {
  it('parses a standard table with serials, codes, header and summary row', () => {
    const result = parseAttendanceLines(
      lines(
        ['Sr No', 'Code', 'Subject', 'Total Lectures', 'Lectures Attended', 'Lectures Absent', 'Attendance %'],
        ['1', 'CS201', 'Data Structures', '52', '44', '8', '84.62'],
        ['2', 'CS202', 'Operating Systems', '48', '30', '18', '62.50'],
        ['', '', 'Total', '100', '74', '26', '74.00'],
      ),
    );
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0]).toMatchObject({ code: 'CS201', name: 'Data Structures', total: 52, attended: 44, confidence: 'high' });
    expect(result.subjects[1]).toMatchObject({ code: 'CS202', name: 'Operating Systems', total: 48, attended: 30 });
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].name).toMatch(/total/i);
  });

  it('keeps numbers that belong to the subject name', () => {
    const result = parseAttendanceLines(lines(['Engineering Mathematics 3', '55', '49', '6', '89.09']));
    expect(result.subjects[0]).toMatchObject({ name: 'Engineering Mathematics 3', total: 55, attended: 49 });
  });

  it('handles "attended / total" fractions', () => {
    const result = parseAttendanceLines(lines(['Data Structures (CS201)', '44 / 52'], ['Operating Systems (CS202)', '30/48']));
    expect(result.subjects.map((s) => [s.name, s.code, s.attended, s.total])).toEqual([
      ['Data Structures', 'CS201', 44, 52],
      ['Operating Systems', 'CS202', 30, 48],
    ]);
    // nothing cross-checks a bare fraction, so the user is asked to verify
    expect(result.subjects[0].confidence).toBe('low');
  });

  it('works without any header by checking that numbers add up', () => {
    const result = parseAttendanceLines(lines(['1', 'Physics', '40', '3', '37', '92.50']));
    expect(result.subjects[0]).toMatchObject({ name: 'Physics', total: 40, attended: 37 });
    expect(result.headerFound).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/review every row/i);
  });

  it('flags a printed percentage that disagrees with the numbers', () => {
    const result = parseAttendanceLines(
      lines(['Code', 'Subject', 'Total', 'Present', '%'], ['CS201', 'Data Structures', '50', '40', '60.00']),
    );
    // 40/50 = 80% but the PDF says 60% - header order is rejected, heuristics find no consistent reading
    const s = result.subjects[0];
    expect(s.flags.length).toBeGreaterThan(0);
    expect(s.confidence).not.toBe('high');
  });

  it('excludes duplicates until confirmed and never double counts silently', () => {
    const result = parseAttendanceLines(
      lines(
        ['Code', 'Subject', 'Total', 'Present', 'Absent', '%'],
        ['CS201', 'Data Structures', '52', '44', '8', '84.62'],
        ['CS201', 'Data Structures', '52', '44', '8', '84.62'],
        ['CS201', 'Data Structures', '13', '11', '2', '84.62'],
      ),
    );
    expect(result.subjects).toHaveLength(3);
    expect(result.subjects.map((s) => s.included)).toEqual([true, false, false]);
    expect(result.subjects[1].flags.join(' ')).toMatch(/duplicate/i);
    expect(result.subjects[2].flags.join(' ')).toMatch(/different numbers/i);
  });

  it('flags a missing subject name', () => {
    const result = parseAttendanceLines(lines(['Total', 'Present', 'Absent', '%'], ['', '40', '36', '4', '90.00']));
    const s = result.subjects[0];
    expect(s.name).toBe('');
    expect(s.fieldFlags.name).toBe(true);
  });

  it('ignores student/metadata lines that happen to end in numbers', () => {
    const result = parseAttendanceLines(
      lines(
        'Semester 3 Roll No 21045',
        'Attendance Report as on 24/10/2026',
        ['Data Structures', '52', '44', '8', '84.62'],
      ),
    );
    expect(result.subjects).toHaveLength(1);
  });

  it('throws a helpful NO_TABLE error with the text it saw', () => {
    try {
      parseAttendanceLines(lines('Library Rules', 'Books may be borrowed for fourteen days.'));
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfParseError);
      expect(err.code).toBe('NO_TABLE');
      expect(err.rawText).toContain('Library Rules');
    }
  });

  describe('PDF format identification & specialized parsing', () => {
    it('correctly extracts student and session metadata from report headers', () => {
      const headerLines = lines(
        'Attendance Report',
        'Student Name JANHAVI SHINTRE',
        'Student Number 60003250279',
        'Roll No. I062',
        'Academic Year & Academic Session 2026-2027, Semester III',
        'Program Name B.Tech in Information Technology',
        'Attendance Report Duration : From 01.10.2026 to 25.10.2026',
      );
      const res = parseAttendanceLines([
        ...headerLines,
        { page: 1, cells: ['1', 'Data Structures', 'Theory', '13', '13', '100.00', '3'] },
      ]);

      expect(res.student).toMatchObject({
        name: 'JANHAVI SHINTRE',
        studentNumber: '60003250279',
        rollNo: 'I062',
        session: '2026-2027, Semester III',
        program: 'B.Tech in Information Technology',
        duration: '01.10.2026 to 25.10.2026',
      });
    });

    it('identifies and parses Detailed Session Log (PDF 1) by aggregating lectures', () => {
      const detailedReport = lines(
        'Attendance Report',
        'Student Name JANHAVI SHINTRE',
        'Student Number 60003250279',
        'Roll No. I062',
        'Academic Year & Academic Session 2026-2027, Semester III',
        'Program Name B.Tech in Information Technology',
        'Attendance Report Duration : From 01.10.2026 to 25.10.2026',
        ['Sr No.', 'Course Name', 'Date', 'Start Time', 'End Time', 'Attendance'],
        ['1', 'Database Management SystemT- I1', 'Oct 1, 2026', '9:00:01 AM', '10:00:00 AM', 'P'],
        ['2', 'Database Management SystemT- I1', 'Oct 6, 2026', '1:00:01 PM', '2:00:00 PM', 'P'],
        ['3', 'Database Management SystemT- I1', 'Oct 15, 2026', '9:00:01 AM', '10:00:00 AM', 'A'],
        ['4', 'Database Management SystemT- I1', 'Oct 23, 2026', '10:00:01 AM', '11:00:00 AM', 'NU'],
        ['5', 'Database Management System LabP- I1-2', 'Oct 1, 2026', '2:00:01 PM', '3:00:00 PM', 'P'],
        ['6', 'Database Management System LabP- I1-2', 'Oct 1, 2026', '3:00:01 PM', '4:00:00 PM', 'P'],
        ['7', 'Innovative Product Development I U- I1', 'Oct 5, 2026', '12:00:01 PM', '1:00:00 PM', 'P'],
        ['8', 'Innovative Product Development I U- I1', 'Oct 19, 2026', '12:00:01 PM', '1:00:00 PM', 'NU'],
        'P - Present : A - Absent : AG - Attendance Granted : L - Late Admission : NU - Not Updated',
      );

      const result = parseAttendanceLines(detailedReport);

      expect(result.reportType).toBe('detailed');
      expect(result.subjects).toHaveLength(3);

      const dbmsTheory = result.subjects.find((s) => s.name.includes('Database Management System (Theory)'));
      expect(dbmsTheory).toBeDefined();
      // 2 P, 1 A, 1 NU -> Total conducted: 3, Attended: 2, Not updated: 1
      expect(dbmsTheory.total).toBe(3);
      expect(dbmsTheory.attended).toBe(2);
      expect(dbmsTheory.notUpdated).toBe(1);
      expect(dbmsTheory.flags.join(' ')).toContain('1 lecture is not updated yet');

      const dbmsLab = result.subjects.find((s) => s.name.includes('Laboratory (Practical)'));
      expect(dbmsLab).toBeDefined();
      expect(dbmsLab.total).toBe(2);
      expect(dbmsLab.attended).toBe(2);
      expect(dbmsLab.notUpdated).toBe(0);

      const ipd = result.subjects.find((s) => s.name.includes('Innovative Product Development I'));
      expect(ipd).toBeDefined();
      expect(ipd.name).toContain('(Tutorial)');
      expect(ipd.total).toBe(1);
      expect(ipd.attended).toBe(1);
      expect(ipd.notUpdated).toBe(1);
    });

    it('identifies and parses Course Summary Report (PDF 2) directly', () => {
      const summaryReport = lines(
        'Attendance Report',
        'Student Name JANHAVI SHINTRE',
        'Student Number 60003250279',
        'Roll No. I062',
        'Academic Year & Academic Session 2026-2027, Semester III',
        'Program Name B.Tech in Information Technology',
        'Attendance Report Duration : From 01.10.2026 to 31.10.2026',
        ['Sr.No', 'Course Name', 'Lecture Type', 'Lecture Conducted', 'Lecture Attended(P)', '% Attendence', 'Lecture status not updated'],
        ['1', 'Entrepreneurship and Startup Ecosystem', 'Theory', '9', '9', '100.00', '3'],
        ['2', 'Community Engagement Service', 'Tutorial', '6', '6', '100.00', '2'],
        ['3', 'Database Management System', 'Theory', '9', '8', '88.89', '4'],
        ['4', 'Database Management System Laboratory', 'Practical', '8', '8', '100.00', '2'],
        'Above data is viewed as per attendance data in the SAP system.',
      );

      const result = parseAttendanceLines(summaryReport);

      expect(result.reportType).toBe('summary');
      expect(result.subjects).toHaveLength(4);

      const dbms = result.subjects.find((s) => s.name === 'Database Management System (Theory)');
      expect(dbms).toMatchObject({
        total: 9,
        attended: 8,
        notUpdated: 4,
        confidence: 'high',
      });
      expect(dbms.flags[0]).toMatch(/4 lectures are not updated yet/i);

      const dbmsLab = result.subjects.find((s) => s.name === 'Database Management System Laboratory (Practical)');
      expect(dbmsLab).toMatchObject({
        total: 8,
        attended: 8,
        notUpdated: 2,
      });

      const es = result.subjects.find((s) => s.name === 'Entrepreneurship and Startup Ecosystem (Theory)');
      expect(es).toMatchObject({
        total: 9,
        attended: 9,
        notUpdated: 3,
      });
    });

    it('handles multiline course names in summary reports', () => {
      const summaryReport = lines(
        ['Sr.No', 'Course Name', 'Lecture Type', 'Lecture Conducted', 'Lecture Attended(P)', '% Attendence', 'Lecture status not updated'],
        ['1', 'Entrepreneurship and Startup'],
        ['Ecosystem', 'Theory', '9', '9', '100.00', '3'],
      );

      const result = parseAttendanceLines(summaryReport);
      expect(result.subjects).toHaveLength(1);
      expect(result.subjects[0].name).toBe('Entrepreneurship and Startup Ecosystem (Theory)');
      expect(result.subjects[0].attended).toBe(9);
      expect(result.subjects[0].total).toBe(9);
    });
  });
});

describe('real PDF extraction (pdfjs-dist in Node)', () => {
  const load = async (name) => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(readFileSync(path.join(sampleDir, name)));
    return { pdfjs, data };
  };

  it('parses the bundled sample report end to end', async () => {
    const { pdfjs, data } = await load('sample-attendance.pdf');
    const { lines: extracted } = await extractLinesFromData(data, pdfjs);
    const result = parseAttendanceLines(extracted);
    expect(result.subjects).toHaveLength(7);
    const byCode = Object.fromEntries(result.subjects.map((s) => [s.code, s]));
    expect(byCode.CS201).toMatchObject({ name: 'Data Structures', total: 52, attended: 44, confidence: 'high' });
    expect(byCode.MA203).toMatchObject({ name: 'Engineering Mathematics III', total: 55, attended: 49 });
    expect(byCode.HS206).toMatchObject({ total: 30, attended: 17 });
    expect(result.skipped).toHaveLength(1); // the "Total" row is not counted as a subject
    expect(result.subjects.every((s) => s.included && s.confidence === 'high')).toBe(true);
  });

  it('parses a fraction-style report and asks for verification', async () => {
    const { pdfjs, data } = await load('fixture-fraction.pdf');
    const { lines: extracted } = await extractLinesFromData(data, pdfjs);
    const result = parseAttendanceLines(extracted);
    expect(result.subjects).toHaveLength(4);
    expect(result.subjects[0]).toMatchObject({ code: 'CS201', attended: 44, total: 52 });
  });

  it('excludes repeated tables from the count until confirmed', async () => {
    const { pdfjs, data } = await load('fixture-duplicates.pdf');
    const { lines: extracted } = await extractLinesFromData(data, pdfjs);
    const result = parseAttendanceLines(extracted);
    expect(result.subjects.filter((s) => s.included)).toHaveLength(3);
    expect(result.subjects.filter((s) => !s.included).length).toBeGreaterThanOrEqual(2);
  });

  it('detects a scanned PDF', async () => {
    const { pdfjs, data } = await load('fixture-scanned.pdf');
    await expect(extractLinesFromData(data, pdfjs)).rejects.toMatchObject({ code: 'SCANNED' });
  });

  it('reports a PDF with text but no table', async () => {
    const { pdfjs, data } = await load('fixture-no-table.pdf');
    const { lines: extracted } = await extractLinesFromData(data, pdfjs);
    expect(() => parseAttendanceLines(extracted)).toThrowError(/no attendance rows/i);
  });

  it('reports a corrupted PDF', async () => {
    const { pdfjs, data } = await load('fixture-corrupted.pdf');
    await expect(extractLinesFromData(data, pdfjs)).rejects.toMatchObject({ code: 'INVALID_PDF' });
  });
});
