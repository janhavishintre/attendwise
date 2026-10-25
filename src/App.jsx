import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Dashboard, { EmptyState } from './components/Dashboard.jsx';
import PDFUploader from './components/PDFUploader.jsx';
import ExtractedDataReview from './components/ExtractedDataReview.jsx';
import AttendanceSimulator from './components/AttendanceSimulator.jsx';
import AttendanceSettings from './components/AttendanceSettings.jsx';
import SubjectDetail from './components/SubjectDetail.jsx';
import PrintReport from './components/PrintReport.jsx';
import AuthModal from './components/AuthModal.jsx';
import AuthPage from './components/AuthPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { normalizeTarget, summarize } from './utils/attendanceCalculator.js';
import { clearState, createId, loadState, saveState } from './utils/storage.js';
import { downloadCsv } from './utils/exporters.js';
import { getSampleSubjects } from './data/sampleData.js';

const TITLES = {
  dashboard: ['Dashboard', 'Your attendance at a glance'],
  simulator: ['Attendance simulator', 'See what future lectures do to your percentage'],
  upload: ['Upload attendance PDF', 'Read your college report on this device'],
  review: ['Review subjects', 'Confirm the numbers before they are used'],
  edit: ['Edit subjects', 'Correct, add or remove subjects'],
  settings: ['Settings', 'Target percentage and saved data'],
  auth: ['Account & Login Activity', 'MongoDB Atlas authenticated user profile and login history'],
};

export default function App() {
  const { isAuthenticated, isGuest, continueAsGuest, loading } = useAuth();
  const [initial] = useState(() => loadState());
  const [data, setData] = useState(initial.state);
  const [notice, setNotice] = useState(initial.notice);
  const [view, setView] = useState('dashboard');
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const hasData = data.subjects.length > 0;

  // Persist every change.
  useEffect(() => {
    if (data.updatedAt === null && data.subjects.length === 0) return;
    setSaveFailed(!saveState(data));
  }, [data]);

  const summary = useMemo(() => summarize(data.subjects, data.target), [data.subjects, data.target]);
  const selected = summary.analyzed.find((s) => s.id === selectedId) || null;

  const setTarget = useCallback((t) => setData((d) => ({ ...d, target: normalizeTarget(t) })), []);
  const setPlans = useCallback((plans) => setData((d) => ({ ...d, plans })), []);

  const go = (id) => {
    if (id === 'edit') {
      startEdit();
      return;
    }
    setDraft(null);
    setView(id);
  };

  const startEdit = () => {
    setDraft({
      mode: 'edit',
      subjects: data.subjects.map((s) => ({ ...s, included: true, confidence: 'high', flags: [], fieldFlags: {} })),
      skipped: [],
      warnings: [],
      rawText: '',
      fileName: data.fileName,
    });
    setView('edit');
  };

  const startManual = () => {
    if (hasData) {
      startEdit();
      return;
    }
    setDraft({
      mode: 'manual',
      subjects: [{ id: createId(), code: '', name: '', attended: null, total: null, included: true, confidence: 'high', flags: [], fieldFlags: {} }],
      skipped: [],
      warnings: [],
      rawText: '',
      fileName: '',
    });
    setView('review');
  };

  const onParsed = (result) => {
    setDraft({
      mode: 'pdf',
      subjects: result.subjects,
      skipped: result.skipped,
      warnings: result.warnings,
      rawText: result.rawText,
      fileName: result.fileName,
      reportType: result.reportType,
      student: result.student,
    });
    setView('review');
  };

  const confirmDraft = (subjects, fileName, student) => {
    setData((d) => {
      const ids = new Set(subjects.map((s) => s.id));
      const plans = Object.fromEntries(Object.entries(d.plans).filter(([id]) => ids.has(id)));
      return {
        ...d,
        subjects,
        fileName: fileName || d.fileName,
        updatedAt: new Date().toISOString(),
        plans,
        student: student || d.student || null,
      };
    });
    setDraft(null);
    setView('dashboard');
  };

  const loadSample = () => {
    setData((d) => ({
      ...d,
      subjects: getSampleSubjects(),
      fileName: 'Sample data',
      updatedAt: new Date().toISOString(),
      plans: {},
      student: null,
    }));
    setDraft(null);
    setView('dashboard');
  };

  const clearAll = () => {
    clearState();
    setData({ subjects: [], target: data.target, fileName: '', updatedAt: null, plans: {}, student: null });
    setSelectedId(null);
    setDraft(null);
    setView('dashboard');
  };

  const cancelDraft = () => {
    setDraft(null);
    setView(hasData ? 'dashboard' : 'upload');
  };

  const printReport = () => window.print();

  const [title, subtitle] = TITLES[view] || TITLES.dashboard;
  const navView = view === 'review' ? 'upload' : view;

  let content;
  if ((view === 'review' || view === 'edit') && draft) {
    content = (
      <ExtractedDataReview
        draft={draft}
        onChange={setDraft}
        onConfirm={confirmDraft}
        onCancel={cancelDraft}
        onUploadAnother={() => {
          setDraft(null);
          setView('upload');
        }}
        target={data.target}
      />
    );
  } else if (view === 'upload') {
    content = <PDFUploader onParsed={onParsed} onManual={startManual} onSample={loadSample} hasData={hasData} />;
  } else if (view === 'settings') {
    content = (
      <AttendanceSettings
        target={data.target}
        onTargetChange={setTarget}
        onClear={clearAll}
        hasData={hasData}
        updatedAt={data.updatedAt}
        fileName={data.fileName}
      />
    );
  } else if (view === 'auth') {
    content = <AuthPage onBack={() => setView(hasData ? 'dashboard' : 'upload')} />;
  } else if (!hasData) {
    content = <EmptyState onUpload={() => setView('upload')} onSample={loadSample} onManual={startManual} />;
  } else if (view === 'simulator') {
    content = <AttendanceSimulator summary={summary} target={data.target} plans={data.plans} onPlansChange={setPlans} />;
  } else {
    content = (
      <Dashboard
        summary={summary}
        target={data.target}
        student={data.student}
        onSelect={setSelectedId}
        onExportCsv={() => downloadCsv(summary, data.target)}
        onPrint={printReport}
        onEdit={startEdit}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-600">Loading AttendWise...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return (
      <AuthPage
        isFirstPage
        onContinueAsGuest={continueAsGuest}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen print:hidden">
        <Sidebar view={navView} onNavigate={go} hasData={hasData} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="lg:pl-64">
          <Header
            title={title}
            subtitle={subtitle}
            target={data.target}
            onTargetChange={setTarget}
            onUpload={() => go('upload')}
            onMenu={() => setMenuOpen(true)}
            onAuthClick={() => go('auth')}
          />
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            {notice && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="flex-1">{notice}</p>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="rounded p-0.5 hover:bg-amber-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {saveFailed && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                Your data could not be saved in this browser (storage may be full or blocked, for example in a private window). It will be lost when you close or refresh the page.
              </div>
            )}
            {content}
          </main>
        </div>
        {selected && <SubjectDetail subject={selected} target={data.target} onClose={() => setSelectedId(null)} />}
        <AuthModal onFullView={() => go('auth')} />
      </div>
      {hasData && <PrintReport summary={summary} target={data.target} fileName={data.fileName} student={data.student} />}
    </>
  );
}
