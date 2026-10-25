import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ onFullView }) {
  const { modalOpen, modalMode, setModalMode, closeModal, login, register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [modalMode, modalOpen]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && modalOpen && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      if (modalMode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password, rollNo });
        setSuccess('Account created successfully! Welcome to AttendWise.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header background banner */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-700 px-6 py-8 text-white">
          <button
            type="button"
            onClick={closeModal}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight">
                {modalMode === 'login' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-xs text-white/80">
                {modalMode === 'login'
                  ? 'Sign in to access your saved attendance and logs'
                  : 'Join AttendWise to track attendance and projections'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-sm font-medium">
          <button
            type="button"
            onClick={() => setModalMode('login')}
            className={`flex-1 py-3 text-center transition ${
              modalMode === 'login'
                ? 'border-b-2 border-brand-600 bg-white font-semibold text-brand-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setModalMode('signup')}
            className={`flex-1 py-3 text-center transition ${
              modalMode === 'signup'
                ? 'border-b-2 border-brand-600 bg-white font-semibold text-brand-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Body form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="alert">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {modalMode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Full Name</label>
                <div className="relative mt-1">
                  <UserIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Janhavi Shintre"
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Roll Number (Optional)</label>
                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g. I062"
                  className="input mt-1"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Email Address</label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Password</label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md transition disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {modalMode === 'login' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : modalMode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure MongoDB Atlas
            </span>
            {onFullView && (
              <button
                type="button"
                onClick={() => {
                  closeModal();
                  onFullView();
                }}
                className="text-brand-600 hover:underline"
              >
                Full screen page →
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
