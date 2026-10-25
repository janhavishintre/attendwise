/**
 * localStorage persistence with validation.
 * Stored data is never trusted: it is sanitised on load, and anything invalid
 * or from an unknown schema version is discarded with a message for the user.
 */
import { DEFAULT_TARGET, normalizeTarget } from './attendanceCalculator.js';

export const STORAGE_KEY = 'attendwise:v1';
export const SCHEMA_VERSION = 1;

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const emptyState = () => ({
  subjects: [],
  target: DEFAULT_TARGET,
  fileName: '',
  updatedAt: null,
  plans: {},
  student: null,
});

const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= 100000;

function sanitizeSubject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 120) : '';
  const code = typeof raw.code === 'string' ? raw.code.slice(0, 30) : '';
  const attended = isCount(raw.attended) ? raw.attended : null;
  const total = isCount(raw.total) ? raw.total : null;
  if (!name.trim() || attended === null || total === null || attended > total) return null;
  const sub = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
    name,
    code,
    attended,
    total,
  };
  if (raw.notUpdated !== undefined) {
    sub.notUpdated = isCount(raw.notUpdated) ? raw.notUpdated : 0;
  }
  if (raw.lectureType !== undefined) {
    sub.lectureType = typeof raw.lectureType === 'string' ? raw.lectureType.slice(0, 30) : '';
  }
  return sub;
}

function sanitizeStudent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 100) : '',
    studentNumber: typeof raw.studentNumber === 'string' ? raw.studentNumber.slice(0, 50) : '',
    rollNo: typeof raw.rollNo === 'string' ? raw.rollNo.slice(0, 50) : '',
    session: typeof raw.session === 'string' ? raw.session.slice(0, 100) : '',
    program: typeof raw.program === 'string' ? raw.program.slice(0, 100) : '',
    duration: typeof raw.duration === 'string' ? raw.duration.slice(0, 100) : '',
  };
}

function sanitizePlans(raw, validIds) {
  const plans = {};
  if (!raw || typeof raw !== 'object') return plans;
  for (const id of validIds) {
    const p = raw[id];
    if (p && isCount(p.attend) && isCount(p.miss)) plans[id] = { attend: p.attend, miss: p.miss };
  }
  return plans;
}

/** Returns { state, notice } - notice is a user-facing message when something had to be dropped. */
export function loadState(storage = globalThis.localStorage) {
  let text;
  try {
    text = storage?.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), notice: 'Saved data could not be read (browser storage is unavailable). Changes will not be kept after a refresh.' };
  }
  if (!text) return { state: emptyState(), notice: null };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    clearState(storage);
    return { state: emptyState(), notice: 'Your saved data was damaged and has been reset. Please upload your PDF again.' };
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.subjects)) {
    clearState(storage);
    return { state: emptyState(), notice: 'Your saved data was from an older or unknown version of AttendWise and has been reset.' };
  }

  const subjects = parsed.subjects.map(sanitizeSubject).filter(Boolean);
  const dropped = parsed.subjects.length - subjects.length;
  const state = {
    subjects,
    target: normalizeTarget(parsed.target),
    fileName: typeof parsed.fileName === 'string' ? parsed.fileName.slice(0, 200) : '',
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    plans: sanitizePlans(parsed.plans, subjects.map((s) => s.id)),
  };
  if (parsed.student) {
    state.student = sanitizeStudent(parsed.student);
  }
  return {
    state,
    notice: dropped > 0 ? `${dropped} saved subject${dropped > 1 ? 's were' : ' was'} invalid and removed. Please check your list.` : null,
  };
}

/** Returns true when the data was saved. */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    const toSave = {
      version: SCHEMA_VERSION,
      subjects: state.subjects,
      target: state.target,
      fileName: state.fileName,
      updatedAt: state.updatedAt,
      plans: state.plans,
    };
    if (state.student) {
      toSave.student = state.student;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - nothing to clear */
  }
}
