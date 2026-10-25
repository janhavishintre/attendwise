// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App.jsx';
import { STORAGE_KEY } from './utils/storage.js';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = RO;
  localStorage.clear();
});
afterEach(() => cleanup());

describe('AttendWise app', () => {
  it('shows the empty state, then loads sample data with correct calculations', () => {
    render(<App />);
    expect(screen.getByText(/Upload your attendance PDF to get started/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /try sample data/i }));

    // The spec's worked example: 30/50 = 60%, needs 30 more in a row.
    const card = screen.getByRole('button', { name: /Worked Example \(30 of 50\)/ });
    expect(within(card).getByText('60.00%')).toBeTruthy();
    expect(within(card).getByText('Attend 30 more in a row')).toBeTruthy();

    // Overall = sum / sum: (44+30+49+28+36+17+22+30) / (52+48+55+46+40+30+24+50) = 256 / 345
    expect(screen.getAllByText('74.20%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('256 / 345').length).toBeGreaterThan(0);

    // Data is persisted.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).subjects).toHaveLength(8);
  });

  it('recalculates when the target changes', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /try sample data/i }));
    const target = screen.getByLabelText('Target', { selector: '#header-target' });
    fireEvent.change(target, { target: { value: '80' } });
    const card = screen.getByRole('button', { name: /Worked Example \(30 of 50\)/ });
    // (0.8*50 - 30)/0.2 = 50
    expect(within(card).getByText('Attend 50 more in a row')).toBeTruthy();
  });

  it('opens the detail view with the working', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /try sample data/i }));
    fireEvent.click(screen.getByRole('button', { name: /Worked Example \(30 of 50\)/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/= 30 lectures in a row/)).toBeTruthy();
    expect(within(dialog).getByText(/60 ÷ 80/)).toBeTruthy();
  });

  it('simulator projects attendance and warns below target', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /try sample data/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /simulator/i })[0]);
    const row = screen.getByText('Worked Example (30 of 50)').closest('.card');
    const [attend, miss] = within(row).getAllByRole('spinbutton');
    fireEvent.change(attend, { target: { value: '30' } });
    expect(within(row).getByText('75.00%')).toBeTruthy();
    fireEvent.change(attend, { target: { value: '10' } });
    fireEvent.change(miss, { target: { value: '10' } });
    expect(within(row).getByText('57.14%')).toBeTruthy(); // 40/70
    expect(within(row).getByRole('alert').textContent).toMatch(/falls below 75%/);
  });

  it('manual entry validates before confirming', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }));
    const confirm = screen.getByRole('button', { name: /confirm & calculate/i });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Subject name'), { target: { value: 'Maths' } });
    fireEvent.change(screen.getByLabelText('Lectures attended'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Total lectures conducted'), { target: { value: '10' } });
    expect(screen.getByText(/Attended cannot be more than total/)).toBeTruthy();
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lectures attended'), { target: { value: '5' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: /^Maths/ })).toBeTruthy();
  });

  it('recovers from corrupted saved data with a message', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    render(<App />);
    expect(screen.getByText(/saved data was damaged/i)).toBeTruthy();
    expect(screen.getByText(/Upload your attendance PDF to get started/i)).toBeTruthy();
  });

  it('keeps data across a refresh and clears it on request', () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /try sample data/i }));
    first.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: /Worked Example/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /settings/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText(/Upload your attendance PDF to get started/i)).toBeTruthy();
  });
});
