import { useEffect } from 'react';
import { CheckCheck, FileUp, LayoutDashboard, ListChecks, Settings, SlidersHorizontal, X } from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'simulator', label: 'Simulator', Icon: SlidersHorizontal },
  { id: 'upload', label: 'Upload PDF', Icon: FileUp },
  { id: 'edit', label: 'Edit subjects', Icon: ListChecks },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
        <CheckCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-bold leading-tight text-slate-900">AttendWise</p>
        <p className="text-xs text-slate-500">Know your attendance</p>
      </div>
    </div>
  );
}

function NavList({ view, onNavigate, disabledIds }) {
  return (
    <nav className="mt-8 space-y-1" aria-label="Main">
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const active = view === id;
        const disabled = disabledIds.includes(id);
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onNavigate(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

import { useAuth } from '../context/AuthContext.jsx';

function UserFooter({ onNavigate }) {
  const { user, isAuthenticated, openLogin, logout } = useAuth();

  return (
    <div className="mt-auto pt-4 border-t border-slate-100">
      {isAuthenticated ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="flex-1 rounded-lg px-2 py-1 text-center text-xs font-medium text-brand-600 hover:bg-brand-50"
            >
              Account & Logins
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2 py-1 text-center text-xs font-medium text-red-500 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          Sign In / Create Account
        </button>
      )}
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-slate-400">
        MongoDB Cloud Auth • PDF processed on device
      </p>
    </div>
  );
}

export default function Sidebar({ view, onNavigate, hasData, mobileOpen, onClose }) {
  const disabledIds = hasData ? [] : ['simulator', 'edit'];

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <Brand />
        <NavList view={view} onNavigate={onNavigate} disabledIds={disabledIds} />
        <UserFooter onNavigate={onNavigate} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <Brand />
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList
              view={view}
              onNavigate={(id) => {
                onNavigate(id);
                onClose();
              }}
              disabledIds={disabledIds}
            />
            <UserFooter
              onNavigate={(id) => {
                onNavigate(id);
                onClose();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
