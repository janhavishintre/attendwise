import { formatPercent } from './attendanceCalculator.js';

/** Neutralise spreadsheet formula injection and quote CSV cells. */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const statusLabel = {
  below: 'Below target',
  reached: 'At target',
  safe: 'Safe',
  'no-data': 'No data',
};

export function buildCsv(summary, target) {
  const header = ['Subject', 'Code', 'Total lectures', 'Attended', 'Missed', 'Attendance %', `Target ${target}%`, 'Status', 'Lectures needed to reach target', 'Lectures you can still miss'];
  const rows = summary.analyzed
    .filter((s) => s.usable)
    .map((s) => [
      s.name,
      s.code || '',
      s.total,
      s.attended,
      s.missed,
      formatPercent(s.percent).replace('%', ''),
      target,
      statusLabel[s.status],
      Number.isFinite(s.required) ? s.required : 'Not reachable',
      s.canMiss,
    ]);
  rows.push([
    'OVERALL (sum of attended / sum of total)',
    '',
    summary.total,
    summary.attended,
    summary.missed,
    formatPercent(summary.overallPercent).replace('%', ''),
    target,
    '',
    Number.isFinite(summary.overallRequired) ? summary.overallRequired : 'Not reachable',
    summary.overallCanMiss,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(summary, target, fileName = 'attendance-summary.csv') {
  const csv = `﻿${buildCsv(summary, target)}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
