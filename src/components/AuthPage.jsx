import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileText,
  Globe,
  GraduationCap,
  Laptop,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage({ onBack, defaultMode = 'login', isFirstPage = false, onContinueAsGuest }) {
  const { user, login, register, logout, recentLogins, fetchLoginHistory, continueAsGuest } = useAuth();

  const [mode, setMode] = useState(defaultMode); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (user) {
      fetchLoginHistory();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        setSuccess('Logged in successfully!');
      } else {
        await register({ name, email, password, rollNo });
        setSuccess('Account created successfully!');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setBusy(false);
    }
  };

  const handleGuestClick = () => {
    if (onContinueAsGuest) {
      onContinueAsGuest();
    } else if (continueAsGuest) {
      continueAsGuest();
    } else if (onBack) {
      onBack();
    }
  };

  // If already logged in, show user profile & login activity log
  if (user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {onBack && (
          <button type="button" onClick={onBack} className="btn-secondary text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        )}

        <div className="card overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-xl font-bold text-white shadow-md">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                <p className="text-sm text-slate-500">{user.email}</p>
                {user.rollNo && (
                  <span className="mt-1 inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-700/10">
                    Roll No: {user.rollNo}
                  </span>
                )}
              </div>
            </div>
            <button type="button" onClick={logout} className="btn-secondary self-start text-xs text-red-600 hover:bg-red-50 sm:self-auto">
              Sign Out
            </button>
          </div>
        </div>

        {/* Login activity history log saved in MongoDB */}
        <div className="card p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Your Login History</h3>
              <p className="text-xs text-slate-500">Every login attempt is stored in your MongoDB database</p>
            </div>
            <button type="button" onClick={fetchLoginHistory} className="text-xs font-medium text-brand-600 hover:underline">
              Refresh
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentLogins.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No login records found yet.</p>
            ) : (
              recentLogins.map((entry) => (
                <div key={entry._id || entry.timestamp} className="flex items-center justify-between py-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        entry.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {entry.status === 'SUCCESS' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">
                        {entry.status === 'SUCCESS' ? 'Successful Sign In' : `Failed Attempt (${entry.failureReason || 'Denied'})`}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> IP: {entry.ipAddress || '127.0.0.1'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 truncate max-w-[200px]" title={entry.userAgent}>
                          <Laptop className="h-3 w-3" /> {entry.userAgent?.includes('Chrome') ? 'Chrome' : 'Browser'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-right text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const authCard = (
    <div className="card overflow-hidden shadow-2xl ring-1 ring-slate-900/10">
      <div className="bg-gradient-to-r from-brand-600 to-indigo-700 p-6 sm:p-8 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur shadow-inner">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Sign In to AttendWise' : 'Create an Account'}
            </h2>
            <p className="text-xs text-white/80">
              {mode === 'login'
                ? 'Access your attendance workspace & login history'
                : 'Join AttendWise to track attendance and stay above 75%'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-slate-50 text-sm font-medium">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`flex-1 py-3 text-center transition ${
            mode === 'login'
              ? 'border-b-2 border-brand-600 bg-white font-semibold text-brand-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`flex-1 py-3 text-center transition ${
            mode === 'signup'
              ? 'border-b-2 border-brand-600 bg-white font-semibold text-brand-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
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

        {mode === 'signup' && (
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
              placeholder="student@college.edu"
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
          className="btn-primary w-full justify-center py-3 text-sm font-semibold shadow-md transition disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === 'login' ? 'Signing in…' : 'Creating account…'}
            </>
          ) : mode === 'login' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </button>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleGuestClick}
            className="text-xs font-medium text-slate-500 hover:text-brand-600 transition"
          >
            Continue as Guest without signing in →
          </button>
        </div>

        <div className="mt-2 border-t border-slate-100 pt-3 text-center">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Database className="h-3 w-3 text-emerald-500" /> Connected to MongoDB database
          </span>
        </div>
      </form>
    </div>
  );

  // When appearing as the initial welcome/landing screen:
  if (isFirstPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: AttendWise Hero Information */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-lg shadow-brand-500/25">
                <Shield className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">AttendWise</h1>
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Attendance Intelligence & Planner</p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Track Smarter. <br />
                <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
                  Never Fall Below 75%.
                </span>
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Upload your college attendance report or enter subjects manually. Get instant analytics, simulation projections, and target calculations.
              </p>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Dual Smart PDF Parser</h4>
                  <p className="text-[11px] text-slate-500">Auto-identifies both lecture-by-lecture logs and semester course summaries with student details.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-sm">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Target Calculator & Simulator</h4>
                  <p className="text-[11px] text-slate-500">Know exactly how many classes you must attend in a row or can safely afford to miss.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">MongoDB Database Login Audit</h4>
                  <p className="text-[11px] text-slate-500">Every login attempt and user profile is recorded in MongoDB with timestamp and device info.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>100% Client-side privacy for your attendance data & PDF reports.</span>
            </div>
          </div>

          {/* Right Column: Sign In / Sign Up Form Card */}
          <div className="lg:col-span-6">
            {authCard}
          </div>
        </div>
      </div>
    );
  }

  // Standard modal or embedded view
  return (
    <div className="mx-auto max-w-md py-6">
      {onBack && (
        <button type="button" onClick={onBack} className="btn-secondary mb-4 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      {authCard}
      <p className="mt-4 text-center text-xs text-slate-400">
        All attendance calculations and PDFs are kept strictly private on your device.
      </p>
    </div>
  );
}
