/**
 * Unit tests for the Renderer module and formatCurrency helper.
 *
 * Because app.js targets the browser, we load it in jsdom (configured via
 * vitest.config.js) so DOM APIs and `document` are available.
 *
 * Strategy:
 *  - Import app.js once; the IIFE modules (State, Storage, Renderer) and the
 *    formatCurrency / _escapeHtml helpers are attached to `globalThis` because
 *    the file uses no ES-module exports.
 *  - For each renderer method, set up the relevant DOM fragments in
 *    `document.body` and call the method, then assert on the DOM.
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Helpers to build a minimal DOM ──────────────────────────────────────────

/**
 * Re-creates a fresh JSDOM environment with the full index.html and re-runs
 * app.js inside it.  Returns the window object.
 *
 * We do this inline rather than relying on Vitest's global jsdom because we
 * need to control localStorage state and module-level State bootstrap per test.
 */
function buildDOM() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  const root       = path.resolve(__dirname, '..');

  const html   = readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs  = readFileSync(path.join(root, 'app.js'),     'utf8');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    // Provide a stub localStorage so Storage works without errors.
    url: 'http://localhost/',
  });

  // Run app.js in the JSDOM window context.
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = appJs;
  dom.window.document.body.appendChild(scriptEl);

  return dom.window;
}

// ── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  let win;

  beforeAll(() => {
    win = buildDOM();
  });

  test('formats zero as $0.00', () => {
    expect(win.formatCurrency(0)).toBe('$0.00');
  });

  test('formats a whole number with two decimal places', () => {
    expect(win.formatCurrency(100)).toBe('$100.00');
  });

  test('formats thousands with comma separator', () => {
    expect(win.formatCurrency(1234.56)).toBe('$1,234.56');
  });

  test('formats large numbers with multiple commas', () => {
    expect(win.formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  test('formats negative numbers with leading minus sign', () => {
    expect(win.formatCurrency(-500)).toBe('-$500.00');
  });

  test('formats negative thousands correctly', () => {
    expect(win.formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  test('rounds to two decimal places', () => {
    // 1.005 may be subject to floating-point: just verify two-decimal output
    const result = win.formatCurrency(1.1);
    expect(result).toBe('$1.10');
  });

  test('matches $X,XXX.XX pattern for arbitrary values', () => {
    const pattern = /^-?\$[\d,]+\.\d{2}$/;
    [0, 1, 999.99, 12345.67, -0.01, 1000000].forEach(n => {
      expect(win.formatCurrency(n)).toMatch(pattern);
    });
  });
});

// ── _escapeHtml ──────────────────────────────────────────────────────────────

describe('_escapeHtml', () => {
  let win;

  beforeAll(() => {
    win = buildDOM();
  });

  test('escapes & < > " \' characters', () => {
    expect(win._escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('returns empty string for non-string input', () => {
    expect(win._escapeHtml(null)).toBe('');
    expect(win._escapeHtml(undefined)).toBe('');
    expect(win._escapeHtml(42)).toBe('');
  });

  test('leaves safe strings unchanged', () => {
    expect(win._escapeHtml('Hello World')).toBe('Hello World');
  });
});

// ── Renderer.renderBalance ───────────────────────────────────────────────────

describe('Renderer.renderBalance', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
  });

  test('displays $0.00 for all fields when there are no transactions', () => {
    win.Renderer.renderBalance();
    const doc = win.document;
    expect(doc.getElementById('balance').textContent).toBe('$0.00');
    expect(doc.getElementById('total-income').textContent).toBe('$0.00');
    expect(doc.getElementById('total-expenses').textContent).toBe('$0.00');
  });

  test('displays correct formatted values after adding transactions', () => {
    // Directly push into State's transactions (internal array via addTransaction).
    win.State.addTransaction({
      description: 'Salary', amount: 2500, type: 'income',
      category: 'Other', date: '2024-06-01',
    });
    win.State.addTransaction({
      description: 'Rent', amount: 1000, type: 'expense',
      category: 'Bills', date: '2024-06-02',
    });

    win.Renderer.renderBalance();
    const doc = win.document;
    expect(doc.getElementById('balance').textContent).toBe('$1,500.00');
    expect(doc.getElementById('total-income').textContent).toBe('$2,500.00');
    expect(doc.getElementById('total-expenses').textContent).toBe('$1,000.00');
  });

  test('displays negative balance with minus sign when expenses exceed income', () => {
    win.State.addTransaction({
      description: 'Dinner', amount: 200, type: 'expense',
      category: 'Food', date: '2024-06-01',
    });
    win.Renderer.renderBalance();
    expect(win.document.getElementById('balance').textContent).toBe('-$200.00');
  });
});

// ── Renderer.renderTransactionList ──────────────────────────────────────────

describe('Renderer.renderTransactionList', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
  });

  test('shows empty-state message when given an empty array', () => {
    win.Renderer.renderTransactionList([]);
    const doc = win.document;
    expect(doc.getElementById('transaction-list').innerHTML).toBe('');
    expect(doc.getElementById('empty-state-transactions').hidden).toBe(false);
  });

  test('hides empty-state when transactions exist', () => {
    const txs = [{
      id: '1', description: 'Lunch', amount: 15.50,
      type: 'expense', category: 'Food',
      date: '2024-06-01', createdAt: 1000,
    }];
    win.Renderer.renderTransactionList(txs);
    expect(win.document.getElementById('empty-state-transactions').hidden).toBe(true);
  });

  test('renders one list item per transaction', () => {
    const txs = [
      { id: '1', description: 'A', amount: 10, type: 'expense',
        category: 'Food', date: '2024-06-01', createdAt: 1000 },
      { id: '2', description: 'B', amount: 20, type: 'income',
        category: 'Other', date: '2024-06-02', createdAt: 2000 },
    ];
    win.Renderer.renderTransactionList(txs);
    const items = win.document.querySelectorAll('#transaction-list .tx-item');
    expect(items.length).toBe(2);
  });

  test('applies tx-income class to income items', () => {
    const txs = [{
      id: '1', description: 'Pay', amount: 100, type: 'income',
      category: 'Other', date: '2024-06-01', createdAt: 1000,
    }];
    win.Renderer.renderTransactionList(txs);
    const item = win.document.querySelector('#transaction-list .tx-item');
    expect(item.classList.contains('tx-income')).toBe(true);
  });

  test('applies tx-expense class to expense items', () => {
    const txs = [{
      id: '1', description: 'Gas', amount: 50, type: 'expense',
      category: 'Transport', date: '2024-06-01', createdAt: 1000,
    }];
    win.Renderer.renderTransactionList(txs);
    const item = win.document.querySelector('#transaction-list .tx-item');
    expect(item.classList.contains('tx-expense')).toBe(true);
  });

  test('sorts transactions in reverse-chronological order by date', () => {
    const txs = [
      { id: '1', description: 'Oldest', amount: 10, type: 'expense',
        category: 'Food', date: '2024-01-01', createdAt: 1000 },
      { id: '3', description: 'Newest', amount: 30, type: 'expense',
        category: 'Food', date: '2024-06-15', createdAt: 3000 },
      { id: '2', description: 'Middle', amount: 20, type: 'expense',
        category: 'Food', date: '2024-03-10', createdAt: 2000 },
    ];
    win.Renderer.renderTransactionList(txs);
    const items = win.document.querySelectorAll('#transaction-list .tx-item');
    expect(items[0].getAttribute('data-id')).toBe('3'); // Newest first
    expect(items[1].getAttribute('data-id')).toBe('2');
    expect(items[2].getAttribute('data-id')).toBe('1'); // Oldest last
  });

  test('each item has a delete button with matching data-id', () => {
    const txs = [{
      id: 'abc123', description: 'Test', amount: 5, type: 'expense',
      category: 'Other', date: '2024-06-01', createdAt: 1000,
    }];
    win.Renderer.renderTransactionList(txs);
    const btn = win.document.querySelector('.btn-delete');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('data-id')).toBe('abc123');
  });

  test('escapes HTML in description to prevent XSS', () => {
    const txs = [{
      id: '1', description: '<script>evil()</script>', amount: 1,
      type: 'expense', category: 'Other', date: '2024-06-01', createdAt: 1000,
    }];
    win.Renderer.renderTransactionList(txs);
    const html = win.document.getElementById('transaction-list').innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ── Renderer.renderChart ─────────────────────────────────────────────────────

describe('Renderer.renderChart', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
  });

  test('shows placeholder and hides canvas when expenseMap is empty', () => {
    win.Renderer.renderChart(new Map());
    const doc = win.document;
    expect(doc.getElementById('chart-placeholder').hidden).toBe(false);
    expect(doc.getElementById('expense-chart').hidden).toBe(true);
  });

  test('shows chart-error and hides placeholder when Chart.js is unavailable', () => {
    // Simulate CDN failure by setting the flag.
    win.__chartJsLoadFailed = true;
    win.Renderer.renderChart(new Map([['Food', 100]]));
    const doc = win.document;
    expect(doc.getElementById('chart-error').hidden).toBe(false);
    expect(doc.getElementById('chart-placeholder').hidden).toBe(true);
    // Reset flag.
    win.__chartJsLoadFailed = false;
  });
});

// ── Renderer.renderMonthlySummary ────────────────────────────────────────────

describe('Renderer.renderMonthlySummary', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
    // Seed some transactions for June 2024.
    win.State.addTransaction({
      description: 'Salary', amount: 3000, type: 'income',
      category: 'Other', date: '2024-06-01',
    });
    win.State.addTransaction({
      description: 'Groceries', amount: 400, type: 'expense',
      category: 'Food', date: '2024-06-05',
    });
    win.State.addTransaction({
      description: 'Bus pass', amount: 100, type: 'expense',
      category: 'Transport', date: '2024-06-10',
    });
  });

  test('shows empty-state message when no transactions exist for that month', () => {
    win.Renderer.renderMonthlySummary(2023, 1); // January 2023 — no data
    const doc = win.document;
    expect(doc.getElementById('summary-empty-state').hidden).toBe(false);
    expect(doc.getElementById('summary-total-income').textContent).toBe('$0.00');
    expect(doc.getElementById('summary-total-expenses').textContent).toBe('$0.00');
    expect(doc.getElementById('summary-net-balance').textContent).toBe('$0.00');
  });

  test('calculates correct monthly income, expenses, and net balance', () => {
    win.Renderer.renderMonthlySummary(2024, 6);
    const doc = win.document;
    expect(doc.getElementById('summary-total-income').textContent).toBe('$3,000.00');
    expect(doc.getElementById('summary-total-expenses').textContent).toBe('$500.00');
    expect(doc.getElementById('summary-net-balance').textContent).toBe('$2,500.00');
  });

  test('renders per-category breakdown table rows for expense transactions', () => {
    win.Renderer.renderMonthlySummary(2024, 6);
    const rows = win.document.querySelectorAll('#summary-category-body tr');
    expect(rows.length).toBe(2); // Food and Transport
  });

  test('hides empty-state when transactions exist', () => {
    win.Renderer.renderMonthlySummary(2024, 6);
    expect(win.document.getElementById('summary-empty-state').hidden).toBe(true);
  });
});

// ── Renderer.showStorageWarning ──────────────────────────────────────────────

describe('Renderer.showStorageWarning', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
  });

  test('makes the storage-warning banner visible', () => {
    win.Renderer.showStorageWarning('Storage unavailable.');
    expect(win.document.getElementById('storage-warning').hidden).toBe(false);
  });

  test('sets the warning message text', () => {
    win.Renderer.showStorageWarning('Custom warning message.');
    expect(win.document.getElementById('storage-warning-message').textContent)
      .toBe('Custom warning message.');
  });
});

// ── Renderer.showValidationError / clearValidationErrors ────────────────────

describe('Renderer.showValidationError and clearValidationErrors', () => {
  let win;

  beforeEach(() => {
    win = buildDOM();
  });

  test('shows the error span with the message for a known field', () => {
    win.Renderer.showValidationError('description', 'Description is required.');
    const errorEl = win.document.getElementById('error-description');
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toBe('Description is required.');
  });

  test('sets aria-invalid on the corresponding input field', () => {
    win.Renderer.showValidationError('amount', 'Invalid amount.');
    const fieldEl = win.document.getElementById('tx-amount');
    expect(fieldEl.getAttribute('aria-invalid')).toBe('true');
  });

  test('clearValidationErrors hides all error spans', () => {
    win.Renderer.showValidationError('description', 'err1');
    win.Renderer.showValidationError('amount', 'err2');
    win.Renderer.clearValidationErrors();

    win.document.querySelectorAll('.validation-error').forEach(el => {
      expect(el.hidden).toBe(true);
    });
  });

  test('clearValidationErrors removes aria-invalid from all fields', () => {
    win.Renderer.showValidationError('description', 'err');
    win.Renderer.clearValidationErrors();

    const fieldEl = win.document.getElementById('tx-description');
    expect(fieldEl.getAttribute('aria-invalid')).toBeNull();
  });
});
