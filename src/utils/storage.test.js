import { beforeEach, describe, expect, it } from 'vitest';
import { clearState, loadState, saveState, STORAGE_KEY } from './storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

describe('storage', () => {
  let storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('round-trips valid data', () => {
    const state = {
      subjects: [{ id: 'a', name: 'Maths', code: 'MA1', attended: 30, total: 50 }],
      target: 80,
      fileName: 'x.pdf',
      updatedAt: '2026-10-25T00:00:00.000Z',
      plans: { a: { attend: 3, miss: 1 } },
    };
    expect(saveState(state, storage)).toBe(true);
    const { state: loaded, notice } = loadState(storage);
    expect(notice).toBeNull();
    expect(loaded).toEqual(state);
  });

  it('starts empty when nothing is saved', () => {
    const { state, notice } = loadState(storage);
    expect(state.subjects).toEqual([]);
    expect(state.target).toBe(75);
    expect(notice).toBeNull();
  });

  it('resets damaged JSON with a message', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    const { state, notice } = loadState(storage);
    expect(state.subjects).toEqual([]);
    expect(notice).toMatch(/damaged/i);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resets an unknown schema version', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, subjects: [] }));
    expect(loadState(storage).notice).toMatch(/older or unknown/i);
  });

  it('drops invalid subjects and fixes a bad target', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        target: 'banana',
        subjects: [
          { id: 'ok', name: 'Good', attended: 5, total: 10 },
          { id: 'bad1', name: 'Over', attended: 11, total: 10 },
          { id: 'bad2', name: '', attended: 1, total: 2 },
          { id: 'bad3', name: 'Neg', attended: -1, total: 2 },
          null,
        ],
      }),
    );
    const { state, notice } = loadState(storage);
    expect(state.subjects.map((s) => s.id)).toEqual(['ok']);
    expect(state.target).toBe(75);
    expect(notice).toMatch(/4 saved subjects were invalid/);
  });

  it('clears saved data', () => {
    saveState({ subjects: [], target: 75, fileName: '', updatedAt: null, plans: {} }, storage);
    clearState(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
