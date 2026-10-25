import { useState, useRef, useEffect } from 'react';
import { CheckCheck, FileUp, LogIn, LogOut, Menu, User, History } from 'lucide-react';
import { TargetInput } from './AttendanceSettings.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ title, subtitle, target, onTargetChange, onUpload, onMenu, onAuthClick }) {
  const { user, isAuthenticated, openLogin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white lg:hidden">
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
          {subtitle && <p className="hidden truncate text-sm text-slate-500 sm:block">{subtitle}</p>}
        </div>

        <TargetInput target={target} onChange={onTargetChange} id="header-target" compact />

        <button type="button" onClick={onUpload} className="btn-primary" aria-label="Upload attendance PDF">
          <FileUp className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        {/* Auth profile or Sign in */}
        {isAuthenticated ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-2.5 transition hover:bg-slate-100"
              aria-label="User profile menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 font-semibold text-xs text-white">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="hidden text-xs font-semibold text-slate-800 sm:inline truncate max-w-[120px]">
                {user?.name}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
                <div className="border-b border-slate-100 px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-slate-500 truncate">{user?.email}</p>
                  {user?.rollNo && <p className="mt-0.5 text-[11px] text-brand-600">Roll No: {user.rollNo}</p>}
                </div>
                <div className="py-1">
                  {onAuthClick && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onAuthClick();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <History className="h-4 w-4 text-slate-400" />
                      Login Activity Log
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openLogin}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-600"
          >
            <LogIn className="h-4 w-4 text-slate-500" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
