import { useMemo, useState } from 'react';
import { Download, FileUp, LayoutGrid, Printer, Rows3, Sparkles, UserPen } from 'lucide-react';
import OverviewCards from './OverviewCards.jsx';
import AttendanceTable from './AttendanceTable.jsx';
import AttendanceChart from './AttendanceChart.jsx';
import SubjectCard from './SubjectCard.jsx';
import { filterSubjects, FILTER_OPTIONS, sortSubjects, SORT_OPTIONS } from '../utils/attendanceCalculator.js';

export function EmptyState({ onUpload, onSample, onManual }) {
  return (
    <div className="card mx-auto mt-6 max-w-2xl p-8 text-center sm:p-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <FileUp className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-slate-900">Upload your attendance PDF to get started</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        AttendWise reads the subjects and lecture counts from your college report, lets you check them, and tells you exactly how many lectures you need to reach your target.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" className="btn-primary" onClick={onUpload}>
          <FileUp className="h-4 w-4" aria-hidden="true" /> Upload PDF
        </button>
        <button type="button" className="btn-secondary" onClick={onSample}>
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Try sample data
        </button>
        <button type="button" className="btn-secondary" onClick={onManual}>
          <UserPen className="h-4 w-4" aria-hidden="true" /> Enter manually
        </button>
      </div>
      <p className="mt-6 text-xs text-slate-400">Your PDF is processed on this device and never uploaded.</p>
    </div>
  );
}

export default function Dashboard({ summary, target, student, onSelect, onExportCsv, onPrint, onEdit }) {
  const [sortBy, setSortBy] = useState('lowest');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState('cards');

  const visible = useMemo(
    () => sortSubjects(filterSubjects(summary.analyzed, filter), sortBy),
    [summary.analyzed, filter, sortBy],
  );

  const incomplete = summary.analyzed.filter((s) => !s.usable);

  return (
    <div className="space-y-6">
      {student && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
              {student.name ? student.name.charAt(0) : 'S'}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-900">{student.name || 'Student'}</h2>
              <p className="truncate text-xs text-slate-500">
                {[student.rollNo && `Roll No: ${student.rollNo}`, student.studentNumber && `ID: ${student.studentNumber}`, student.program, student.session].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
          {student.duration && (
            <span className="self-start rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/60 sm:self-auto">
              Period: {student.duration}
            </span>
          )}
        </div>
      )}

      <OverviewCards summary={summary} target={target} />
      <AttendanceChart subjects={summary.analyzed} target={target} />

      <section aria-label="Subjects" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter subjects">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                  filter === f.value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input w-auto py-1.5">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label="Layout">
              {[
                ['cards', LayoutGrid, 'Card view'],
                ['table', Rows3, 'Table view'],
              ].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLayout(value)}
                  aria-pressed={layout === value}
                  aria-label={label}
                  title={label}
                  className={`rounded-lg p-2 ${layout === value ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={onExportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" /> CSV
            </button>
            <button type="button" className="btn-secondary" onClick={onPrint}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Print / PDF
            </button>
          </div>
        </div>

        {incomplete.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span>
              {incomplete.length} subject{incomplete.length > 1 ? 's have' : ' has'} no lectures conducted or invalid figures and {incomplete.length > 1 ? 'are' : 'is'} left out of the percentages.
            </span>
            <button type="button" className="font-medium underline" onClick={onEdit}>Fix in editor</button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No subjects match this filter.</div>
        ) : layout === 'cards' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((s) => (
              <SubjectCard key={s.id} subject={s} target={target} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <AttendanceTable subjects={visible} target={target} onSelect={onSelect} />
        )}
      </section>
    </div>
  );
}
