import { AlertTriangle, ArrowLeft, Check, FileUp, Plus, Trash2 } from 'lucide-react';
import { attendancePercent, formatPercent, validateSubject } from '../utils/attendanceCalculator.js';
import { createId } from '../utils/storage.js';

const CONFIDENCE = {
  high: { label: 'Checked', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  medium: { label: 'Verify', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  low: { label: 'Please check', cls: 'bg-red-50 text-red-700 ring-red-200' },
};

const toNumber = (value) => (value === '' ? null : Number(value));

export default function ExtractedDataReview({ draft, onChange, onConfirm, onCancel, onUploadAnother, target }) {
  const { subjects, skipped = [], warnings = [], rawText = '', mode } = draft;
  const fromPdf = mode === 'pdf';

  const setSubjects = (next) => onChange({ ...draft, subjects: next });
  const update = (id, patch) => setSubjects(subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const edit = (id, patch, field) =>
    // Editing a flagged field means the user has looked at it, so its highlight is cleared.
    setSubjects(
      subjects.map((s) =>
        s.id === id ? { ...s, ...patch, fieldFlags: { ...(s.fieldFlags || {}), [field]: false } } : s,
      ),
    );
  const remove = (id) => setSubjects(subjects.filter((s) => s.id !== id));
  const add = () =>
    setSubjects([
      ...subjects,
      { id: createId(), code: '', name: '', attended: null, total: null, included: true, confidence: 'high', flags: [], fieldFlags: {} },
    ]);
  const addSkipped = (index) => {
    const row = skipped[index];
    onChange({
      ...draft,
      skipped: skipped.filter((_, i) => i !== index),
      subjects: [
        ...subjects,
        { id: createId(), code: '', name: row.name, attended: row.attended, total: row.total, included: true, confidence: 'medium', flags: ['Added from a summary row - make sure this is a real subject.'], fieldFlags: {} },
      ],
    });
  };

  const included = subjects.filter((s) => s.included);
  const validations = new Map(subjects.map((s) => [s.id, validateSubject(s)]));
  const errorCount = included.filter((s) => !validations.get(s.id).valid).length;
  const unverified = included.filter((s) => s.confidence !== 'high' && (s.flags?.length ?? 0) > 0).length;
  const canConfirm = included.length > 0 && errorCount === 0;

  const confirm = () => {
    onConfirm(
      included.map((s) => ({
        id: s.id,
        code: (s.code || '').trim(),
        name: s.name.trim(),
        attended: s.attended,
        total: s.total,
        notUpdated: s.notUpdated ?? 0,
        lectureType: s.lectureType || '',
      })),
      draft.fileName || '',
      draft.student || null,
    );
  };

  const inputCls = (error, flagged) => `input ${error ? 'input-error' : flagged ? 'input-flag' : ''}`;

  const reportTypeBadge = {
    detailed: { label: 'Detailed Session Log', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
    summary: { label: 'Course Summary Report', cls: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
    generic: { label: 'Standard Report', cls: 'bg-slate-100 text-slate-700 ring-slate-600/20' },
  }[draft.reportType] || null;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {fromPdf ? 'Check the numbers read from your PDF' : mode === 'edit' ? 'Edit your subjects' : 'Enter your subjects'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {fromPdf
                ? 'PDF layouts vary, so nothing is trusted until you confirm it. Highlighted fields could not be cross-checked. Everything recalculates when you confirm.'
                : 'Add one row per subject with total lectures conducted and lectures attended. Percentages update as you type.'}
            </p>
          </div>
          {reportTypeBadge && fromPdf && (
            <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${reportTypeBadge.cls}`}>
              {reportTypeBadge.label}
            </span>
          )}
        </div>

        {draft.student && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {draft.student.name && (
                <span>
                  <strong className="font-semibold text-slate-900">Student:</strong> {draft.student.name}
                </span>
              )}
              {draft.student.rollNo && (
                <span>
                  <strong className="font-semibold text-slate-900">Roll No:</strong> {draft.student.rollNo}
                </span>
              )}
              {draft.student.studentNumber && (
                <span>
                  <strong className="font-semibold text-slate-900">ID:</strong> {draft.student.studentNumber}
                </span>
              )}
              {draft.student.program && (
                <span>
                  <strong className="font-semibold text-slate-900">Program:</strong> {draft.student.program}
                </span>
              )}
              {draft.student.session && (
                <span>
                  <strong className="font-semibold text-slate-900">Session:</strong> {draft.student.session}
                </span>
              )}
            </div>
            {draft.student.duration && (
              <p className="mt-1.5 text-slate-500">Duration: {draft.student.duration}</p>
            )}
          </div>
        )}

        {draft.fileName && fromPdf && <p className="mt-2 text-xs text-slate-400">Source: {draft.fileName}</p>}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <ul className="space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="w-16 px-3 py-3 font-medium">Include</th>
                <th scope="col" className="w-28 px-2 py-3 font-medium">Code</th>
                <th scope="col" className="px-2 py-3 font-medium">Subject name</th>
                <th scope="col" className="w-28 px-2 py-3 font-medium">Attended</th>
                <th scope="col" className="w-28 px-2 py-3 font-medium">Total</th>
                <th scope="col" className="w-24 px-2 py-3 text-right font-medium">Attendance</th>
                {fromPdf && <th scope="col" className="w-28 px-2 py-3 font-medium">Read quality</th>}
                <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={fromPdf ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                    No subjects yet. Add your first one below.
                  </td>
                </tr>
              )}
              {subjects.map((s) => {
                const v = validations.get(s.id);
                const ok = v.valid && s.total > 0;
                const flags = s.flags || [];
                const ff = s.fieldFlags || {};
                const conf = CONFIDENCE[s.confidence] || CONFIDENCE.high;
                const showErrors = s.included;
                return [
                  <tr key={s.id} className={`border-t border-slate-100 align-top ${s.included ? '' : 'bg-slate-50 opacity-70'}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={s.included}
                        onChange={(e) => update(s.id, { included: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Include ${s.name || 'this row'} in calculations`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input className="input" value={s.code || ''} onChange={(e) => update(s.id, { code: e.target.value })} aria-label="Subject code" placeholder="Optional" />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={inputCls(showErrors && v.errors.name, ff.name)}
                        value={s.name}
                        onChange={(e) => edit(s.id, { name: e.target.value }, 'name')}
                        aria-label="Subject name"
                        aria-invalid={Boolean(showErrors && v.errors.name)}
                        placeholder="Subject name"
                      />
                      {showErrors && v.errors.name && <p className="mt-1 text-xs text-red-600">{v.errors.name}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className={inputCls(showErrors && v.errors.attended, ff.attended)}
                        value={s.attended ?? ''}
                        onChange={(e) => edit(s.id, { attended: toNumber(e.target.value) }, 'attended')}
                        aria-label="Lectures attended"
                        aria-invalid={Boolean(showErrors && v.errors.attended)}
                      />
                      {showErrors && v.errors.attended && <p className="mt-1 text-xs text-red-600">{v.errors.attended}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className={inputCls(showErrors && v.errors.total, ff.total)}
                        value={s.total ?? ''}
                        onChange={(e) => edit(s.id, { total: toNumber(e.target.value) }, 'total')}
                        aria-label="Total lectures conducted"
                        aria-invalid={Boolean(showErrors && v.errors.total)}
                      />
                      {showErrors && v.errors.total && <p className="mt-1 text-xs text-red-600">{v.errors.total}</p>}
                      {v.warnings.total && <p className="mt-1 text-xs text-amber-700">{v.warnings.total}</p>}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-medium tabular-nums text-slate-700">
                      {ok ? formatPercent(attendancePercent(s.attended, s.total)) : '-'}
                    </td>
                    {fromPdf && (
                      <td className="px-2 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${conf.cls}`}>{conf.label}</span>
                      </td>
                    )}
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => remove(s.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${s.name || 'row'}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>,
                  flags.length > 0 && (
                    <tr key={`${s.id}-flags`} className={s.included ? '' : 'bg-slate-50 opacity-70'}>
                      <td />
                      <td colSpan={fromPdf ? 7 : 6} className="px-2 pb-3 text-xs text-amber-800">
                        {flags.map((f) => (
                          <p key={f} className="flex items-start gap-1.5">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {f}
                          </p>
                        ))}
                        {s.rawLine && <p className="mt-1 text-slate-400">PDF line: {s.rawLine}</p>}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 p-3">
          <button type="button" className="btn-secondary" onClick={add}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add subject
          </button>
        </div>
      </div>

      {skipped.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900">Rows left out</h3>
          <p className="mt-0.5 text-xs text-slate-500">These look like totals or summaries. Counting them would double count lectures, so they were not added.</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {skipped.map((row, i) => (
              <li key={`${row.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-700">
                  <span className="font-medium">{row.name}</span> - {row.attended} / {row.total}
                </span>
                <button type="button" className="text-xs font-medium text-brand-700 underline" onClick={() => addSkipped(i)}>
                  Add as a subject
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fromPdf && rawText && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Show text extracted from the PDF</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{rawText.slice(0, 8000)}</pre>
        </details>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Cancel
          </button>
          {fromPdf && (
            <button type="button" className="btn-secondary" onClick={onUploadAnother}>
              <FileUp className="h-4 w-4" aria-hidden="true" /> Upload a different PDF
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500" role="status">
              {errorCount > 0
                ? `Fix ${errorCount} row${errorCount > 1 ? 's' : ''} to continue`
                : included.length === 0
                  ? 'Include at least one subject'
                  : `${included.length} subject${included.length > 1 ? 's' : ''} ready${unverified ? ` - ${unverified} still flagged` : ''} (target ${target}%)`}
            </p>
            <button type="button" className="btn-primary" disabled={!canConfirm} onClick={confirm}>
              <Check className="h-4 w-4" aria-hidden="true" /> {mode === 'edit' ? 'Save changes' : 'Confirm & calculate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
