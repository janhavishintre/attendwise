import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, ShieldCheck, Sparkles, UploadCloud, UserPen } from 'lucide-react';
import { parseAttendancePdf } from '../utils/pdfParser.js';

const HINTS = {
  SCANNED: 'This usually means the PDF is a photo or scan. Download the report again from your college portal (the "Download" or "Print to PDF" option rather than a screenshot), or enter the figures manually.',
  NO_TABLE: 'The PDF has text, but it does not look like an attendance table AttendWise knows. You can enter your subjects manually instead.',
  PASSWORD: 'Remove the password in your PDF viewer (or print the PDF to a new file) and try again.',
  INVALID_PDF: 'Try downloading the report again. If it opens normally in your PDF viewer, printing it to a new PDF often fixes it.',
};

export default function PDFUploader({ onParsed, onManual, onSample, hasData }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file || busy) return;
    setError(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const result = await parseAttendancePdf(file);
      onParsed(result);
    } catch (err) {
      setError({
        code: err.code || 'UNKNOWN',
        message: err.message || 'Something went wrong while reading this PDF.',
        rawText: err.rawText || '',
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 1) {
      setError({ code: 'MULTIPLE', message: 'Please upload one PDF at a time.', rawText: '' });
      return;
    }
    handleFile(files[0]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`card border-2 border-dashed p-8 text-center transition sm:p-12 ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
        }`}
      >
        {busy ? (
          <div role="status" aria-live="polite" className="py-4">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-slate-800">Reading {fileName || 'your PDF'}…</p>
            <p className="mt-1 text-xs text-slate-500">Extracting text and looking for attendance rows on this device.</p>
          </div>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Drop your attendance PDF here</h2>
            <p className="mt-1 text-sm text-slate-500">or choose a file from your device</p>
            <input
              ref={inputRef}
              id="pdf-input"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <label htmlFor="pdf-input" className="btn-primary mt-5 cursor-pointer">
              <FileText className="h-4 w-4" aria-hidden="true" /> Choose PDF
            </label>
            <p className="mt-4 text-xs text-slate-400">PDF only, up to 25 MB. Text-based reports work best.</p>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">{error.message}</p>
              {HINTS[error.code] && <p className="mt-1 text-sm text-red-700">{HINTS[error.code]}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
                  Try another PDF
                </button>
                <button type="button" className="btn-secondary" onClick={onManual}>
                  <UserPen className="h-4 w-4" aria-hidden="true" /> Enter manually
                </button>
              </div>
              {error.rawText && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-red-700">Show the text that was read</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">{error.rawText.slice(0, 4000)}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">Private by design.</span> The PDF is read inside your browser. Nothing is uploaded, and you review every extracted number before it is used.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-secondary" onClick={onManual}>
          <UserPen className="h-4 w-4" aria-hidden="true" /> {hasData ? 'Edit subjects' : 'Enter manually'}
        </button>
        <button type="button" className="btn-secondary" onClick={onSample}>
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Load sample data
        </button>
      </div>
    </div>
  );
}
