// app.js — Expense & Budget Visualizer
// Full implementation is added incrementally across Tasks 2–9.

// ─────────────────────────────────────────────────────────────────────────────
// Task 9.1 — Built-in categories constant and category color palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seven built-in spending categories available to all users.
 * These are constant and never stored in localStorage.
 * @type {string[]}
 */
const BUILT_IN_CATEGORIES = [
  'Food',
  'Transport',
  'Entertainment',
  'Health',
  'Shopping',
  'Bills',
  'Other',
];

/**
 * Fixed 10-color palette used for deterministic category color assignment.
 * Colors cycle for indexes beyond the palette length, ensuring every
 * category always maps to the same color across renders and sessions.
 * @type {string[]}
 */
const CATEGORY_COLOR_PALETTE = [
  '#FF6384',
  '#36A2EB',
  '#FFCE56',
  '#4BC0C0',
  '#9966FF',
  '#FF9F40',
  '#FF6384',
  '#C9CBCF',
  '#7BC8A4',
  '#E8A838',
];

/**
 * Returns a deterministic hex color for a given category name.
 *
 * Built-in categories always receive the same color (their fixed index in
 * BUILT_IN_CATEGORIES maps directly to the palette). Custom categories are
 * assigned a color by cycling through the palette starting after the last
 * built-in color slot, keyed by the order they appear in the combined list
 * of all known categories at call time.
 *
 * When called with only the category name (no `allCategories` list), the
 * function falls back to a simple hash of the name so that colors remain
 * stable even if the full list is not available.
 *
 * @param {string} name - The category name to look up.
 * @param {string[]} [allCategories] - Optional ordered list of ALL category
 *   names (built-in first, then custom). When provided, the index in this
 *   list determines the palette slot, guaranteeing colour stability as long
 *   as new categories are appended to the end.
 * @returns {string} A CSS hex color string from CATEGORY_COLOR_PALETTE.
 */
function getCategoryColor(name, allCategories) {
  // Prefer an explicit ordered list for index-based assignment.
  if (allCategories && allCategories.length > 0) {
    const idx = allCategories.indexOf(name);
    if (idx !== -1) {
      return CATEGORY_COLOR_PALETTE[idx % CATEGORY_COLOR_PALETTE.length];
    }
  }

  // Fallback: check built-in list directly.
  const builtInIdx = BUILT_IN_CATEGORIES.indexOf(name);
  if (builtInIdx !== -1) {
    return CATEGORY_COLOR_PALETTE[builtInIdx % CATEGORY_COLOR_PALETTE.length];
  }

  // Last resort: deterministic hash so unknown names still get a stable color.
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.1 — Storage module
// Thin wrapper around localStorage with error isolation.
// All write methods catch exceptions and return { error: true/false } so the
// Controller can show a non-blocking warning without crashing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe localStorage availability once at module initialisation.
 * A write / read / delete cycle is performed inside a try/catch; the result
 * is stored in `_storageAvailable` and consulted by every write method.
 * @type {boolean}
 */
let _storageAvailable = (() => {
  try {
    const probe = '__ebv_probe__';
    localStorage.setItem(probe, '1');
    const ok = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    return ok;
  } catch (_) {
    return false;
  }
})();

/** localStorage key constants */
const STORAGE_KEY_TRANSACTIONS = 'ebv_transactions';
const STORAGE_KEY_CATEGORIES   = 'ebv_custom_categories';
const STORAGE_KEY_THEME        = 'ebv_theme';

const Storage = {
  /**
   * Returns whether localStorage is available in the current environment.
   * @returns {boolean}
   */
  isAvailable() {
    return _storageAvailable;
  },

  /**
   * Reads all persisted app data from localStorage.
   * Each key is parsed in its own try/catch so a malformed value for one
   * key does not prevent the others from loading.
   *
   * @returns {{ transactions: object[], customCategories: string[], theme: string|null }}
   */
  loadAll() {
    let transactions = [];
    let customCategories = [];
    let theme = null;

    // --- transactions ---
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          transactions = parsed;
        }
      }
    } catch (e) {
      console.warn('[Storage] Failed to parse ebv_transactions; using empty list.', e);
    }

    // --- custom categories ---
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          customCategories = parsed;
        }
      }
    } catch (e) {
      console.warn('[Storage] Failed to parse ebv_custom_categories; using empty list.', e);
    }

    // --- theme (bare string, no JSON wrapper) ---
    try {
      const raw = localStorage.getItem(STORAGE_KEY_THEME);
      if (raw !== null) {
        theme = raw; // stored as plain string, not JSON
      }
    } catch (e) {
      console.warn('[Storage] Failed to read ebv_theme; using null.', e);
    }

    return { transactions, customCategories, theme };
  },

  /**
   * Upserts a transaction into the stored array.
   * If a transaction with the same `id` already exists it is replaced;
   * otherwise the new transaction is appended.
   *
   * @param {object} tx - Transaction object to save.
   * @returns {{ error: boolean }}
   */
  saveTransaction(tx) {
    try {
      let stored = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) stored = parsed;
        }
      } catch (_) { /* use empty array */ }

      const idx = stored.findIndex(t => t.id === tx.id);
      if (idx !== -1) {
        stored[idx] = tx; // update
      } else {
        stored.push(tx); // insert
      }

      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(stored));
      return { error: false };
    } catch (e) {
      console.warn('[Storage] saveTransaction failed.', e);
      return { error: true };
    }
  },

  /**
   * Removes the transaction with the given id from the stored array.
   *
   * @param {string} id - Transaction id to remove.
   * @returns {{ error: boolean }}
   */
  deleteTransaction(id) {
    try {
      let stored = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) stored = parsed;
        }
      } catch (_) { /* use empty array */ }

      const filtered = stored.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(filtered));
      return { error: false };
    } catch (e) {
      console.warn('[Storage] deleteTransaction failed.', e);
      return { error: true };
    }
  },

  /**
   * Overwrites the stored custom-category list with the provided array.
   *
   * @param {string[]} cats - Full list of custom category names.
   * @returns {{ error: boolean }}
   */
  saveCustomCategories(cats) {
    try {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
      return { error: false };
    } catch (e) {
      console.warn('[Storage] saveCustomCategories failed.', e);
      return { error: true };
    }
  },

  /**
   * Writes the theme preference as a bare string (no JSON wrapping).
   *
   * @param {string} theme - 'light' or 'dark'.
   * @returns {{ error: boolean }}
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
      return { error: false };
    } catch (e) {
      console.warn('[Storage] saveTheme failed.', e);
      return { error: true };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.1 — State module
// In-memory store for all runtime data.  Populated from Storage at startup.
// All mutations go through the methods below so the Controller can stay thin.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a unique transaction ID.
 * Uses `crypto.randomUUID()` when available (modern browsers / extensions),
 * falling back to a timestamp + random suffix that is unique enough for
 * a single-user, client-only application.
 *
 * @returns {string}
 */
function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now() + '-' + Math.random().toString(36).slice(2);
}

const State = (() => {
  // ── Bootstrap from storage ──────────────────────────────────────────────────
  const _loaded = Storage.loadAll();

  /**
   * All recorded transactions (mutable in-memory copy).
   * @type {object[]}
   */
  let transactions = Array.isArray(_loaded.transactions) ? _loaded.transactions : [];

  /**
   * User-defined category names (mutable in-memory copy).
   * @type {string[]}
   */
  let customCategories = Array.isArray(_loaded.customCategories) ? _loaded.customCategories : [];

  /**
   * Current UI theme, or null if not yet set (Controller will apply OS default).
   * @type {string|null}
   */
  let theme = _loaded.theme || null;

  // ── Public interface ────────────────────────────────────────────────────────
  return {
    // ── Direct data accessors (treat as read-only from outside) ──────────────

    /** @returns {object[]} */
    get transactions() { return transactions; },

    /** @returns {string[]} */
    get customCategories() { return customCategories; },

    /** @returns {string|null} */
    get theme() { return theme; },
    set theme(value) { theme = value; },

    // ── Derived computed values ───────────────────────────────────────────────

    /**
     * Running balance = sum(income amounts) − sum(expense amounts).
     * Uses Array.reduce for a single pass per type.
     * @returns {number}
     */
    getBalance() {
      return this.getTotalIncome() - this.getTotalExpenses();
    },

    /**
     * Sum of all income transaction amounts.
     * @returns {number}
     */
    getTotalIncome() {
      return transactions.reduce((sum, tx) => {
        return tx.type === 'income' ? sum + tx.amount : sum;
      }, 0);
    },

    /**
     * Sum of all expense transaction amounts.
     * @returns {number}
     */
    getTotalExpenses() {
      return transactions.reduce((sum, tx) => {
        return tx.type === 'expense' ? sum + tx.amount : sum;
      }, 0);
    },

    /**
     * Builds a Map from category name → total amount spent for all
     * expense transactions.  Income transactions are ignored.
     *
     * @returns {Map<string, number>}
     */
    getExpensesByCategory() {
      return transactions.reduce((map, tx) => {
        if (tx.type !== 'expense') return map;
        const prev = map.get(tx.category) || 0;
        map.set(tx.category, prev + tx.amount);
        return map;
      }, new Map());
    },

    /**
     * Returns all transactions whose `date` field falls within the given
     * calendar month.  Matching is done on the ISO string prefix "YYYY-MM"
     * so no Date parsing is required and timezone edge-cases are avoided.
     *
     * @param {number} year  - Four-digit year (e.g. 2024).
     * @param {number} month - 1-indexed month (1 = January … 12 = December).
     * @returns {object[]}
     */
    getTransactionsForMonth(year, month) {
      // Build the "YYYY-MM" prefix to match against the ISO date string.
      const mm = String(month).padStart(2, '0');
      const prefix = `${year}-${mm}`;
      return transactions.filter(tx => {
        return typeof tx.date === 'string' && tx.date.startsWith(prefix);
      });
    },

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Validates and adds a new transaction to the in-memory list.
     *
     * Validation rules:
     *   - description.trim() must be non-empty
     *   - amount must be a finite number strictly greater than 0
     *
     * On failure returns an error descriptor so the Controller can show
     * an inline validation message without throwing.
     *
     * @param {{
     *   description: string,
     *   amount: number,
     *   type: 'income'|'expense',
     *   category: string,
     *   date: string
     * }} tx - Partial transaction (id and createdAt are assigned here).
     *
     * @returns {{ error: false, tx: object }
     *          |{ error: true, field: string, message: string }}
     */
    addTransaction(tx) {
      // ── Validate description ────────────────────────────────────────────────
      if (!tx || typeof tx.description !== 'string' || tx.description.trim() === '') {
        return {
          error: true,
          field: 'description',
          message: 'Description is required.',
        };
      }

      // ── Validate amount ─────────────────────────────────────────────────────
      const amount = Number(tx.amount);
      if (!isFinite(amount) || amount <= 0) {
        return {
          error: true,
          field: 'amount',
          message: 'Amount must be a positive number.',
        };
      }

      // ── Build the complete transaction object ────────────────────────────────
      const savedTx = {
        id:          generateTransactionId(),
        description: tx.description.trim(),
        amount,
        type:        tx.type,
        category:    tx.category,
        date:        tx.date,
        createdAt:   Date.now(),
      };

      transactions.push(savedTx);
      return { error: false, tx: savedTx };
    },

    /**
     * Removes the transaction with the given id from the in-memory list.
     *
     * Returns a snapshot of the array taken BEFORE the splice so that the
     * Controller can restore the previous state if the subsequent Storage
     * write fails (requirement 4.4 rollback).
     *
     * @param {string} id - The id of the transaction to delete.
     * @returns {{ snapshot: object[], deletedTx: object|undefined }}
     *   `deletedTx` is undefined when no matching transaction is found.
     */
    deleteTransaction(id) {
      // Snapshot before mutation — shallow copy of the array (objects are
      // not deep-cloned; the Controller only needs to restore the reference).
      const snapshot = transactions.slice();

      const idx = transactions.findIndex(tx => tx.id === id);
      let deletedTx;
      if (idx !== -1) {
        deletedTx = transactions[idx];
        transactions.splice(idx, 1);
      }

      return { snapshot, deletedTx };
    },

    /**
     * Restores the in-memory transactions array to a previous snapshot.
     * Called by the Controller after a Storage write failure.
     *
     * @param {object[]} snapshot
     */
    rollbackTransactions(snapshot) {
      transactions = snapshot;
    },

    /**
     * Validates and adds a new custom category.
     *
     * Validation rules:
     *   - name.trim() must be non-empty
     *   - trimmed name must be ≤ 50 characters
     *   - trimmed name must not case-insensitively match any built-in OR
     *     existing custom category name
     *
     * @param {string} name - The proposed category name.
     * @returns {{ error: false }|{ error: true, message: string }}
     */
    addCustomCategory(name) {
      // ── Validate: non-empty ─────────────────────────────────────────────────
      if (typeof name !== 'string' || name.trim() === '') {
        return { error: true, message: 'Category name is required.' };
      }

      const trimmed = name.trim();

      // ── Validate: length ────────────────────────────────────────────────────
      if (trimmed.length > 50) {
        return {
          error: true,
          message: 'Category name must be 50 characters or fewer.',
        };
      }

      // ── Validate: uniqueness (case-insensitive across built-in + custom) ─────
      const lowerTrimmed = trimmed.toLowerCase();
      const allExisting = [...BUILT_IN_CATEGORIES, ...customCategories];
      const isDuplicate = allExisting.some(
        cat => cat.toLowerCase() === lowerTrimmed
      );
      if (isDuplicate) {
        return {
          error: true,
          message: `"${trimmed}" already exists as a category.`,
        };
      }

      customCategories.push(trimmed);
      return { error: false };
    },
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.1 — Renderer module
// Owns all DOM mutations and the Chart.js instance.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number as a USD currency string: "$X,XXX.XX".
 * Handles negative numbers correctly (e.g., "-$1,234.56").
 *
 * @param {number} n - The numeric value to format.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(n) {
  const abs = Math.abs(n);
  // toFixed(2) gives us two decimal places; then add comma separators.
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = '$' + parts.join('.');
  return n < 0 ? '-' + formatted : formatted;
}

const Renderer = (() => {
  /**
   * Holds the single Chart.js instance for the expense doughnut chart.
   * Null until the chart is first rendered.
   * @type {import('chart.js').Chart | null}
   */
  let _chartInstance = null;

  /**
   * Tracks an active toast timeout so we can cancel it on rapid successive
   * toast calls.
   * @type {ReturnType<typeof setTimeout> | null}
   */
  let _toastTimeout = null;

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Returns the ordered list of all known category names (built-in first,
   * then custom), used for stable color assignments.
   * @returns {string[]}
   */
  function _allCategories() {
    return [...BUILT_IN_CATEGORIES, ...State.customCategories];
  }

  // ── Public interface ────────────────────────────────────────────────────────
  return {
    /**
     * Performs the initial full render on page load.
     * Calls all individual render methods with current State data.
     */
    init() {
      this.renderBalance();
      this.renderTransactionList(State.transactions);
      this.renderChart(State.getExpensesByCategory());
    },

    /**
     * Re-renders all dynamic sections after any state change.
     * Batched inside requestAnimationFrame to guarantee ≤ 300 ms update.
     */
    refresh() {
      requestAnimationFrame(() => {
        this.renderBalance();
        this.renderTransactionList(State.transactions);
        this.renderChart(State.getExpensesByCategory());
      });
    },

    // ── Balance summary ─────────────────────────────────────────────────────

    /**
     * Formats and injects the current balance, total income, and total
     * expenses into the header summary elements.
     *
     * Requirements: 1.3, 1.4
     */
    renderBalance() {
      const balanceEl = document.getElementById('balance');
      const incomeEl  = document.getElementById('total-income');
      const expensesEl = document.getElementById('total-expenses');

      if (balanceEl)   balanceEl.textContent   = formatCurrency(State.getBalance());
      if (incomeEl)    incomeEl.textContent     = formatCurrency(State.getTotalIncome());
      if (expensesEl)  expensesEl.textContent   = formatCurrency(State.getTotalExpenses());
    },

    // ── Transaction list ────────────────────────────────────────────────────

    /**
     * Renders the transaction history list.
     *
     * - Sorts transactions by `date` descending (reverse-chronological),
     *   using `createdAt` as a stable tie-breaker.
     * - Each row shows description, amount, category, type, and date.
     * - Income rows receive class `tx-income`; expense rows `tx-expense`.
     * - Each row has a delete button with `data-id` set to the transaction id.
     * - When the list is empty, the empty-state paragraph is shown instead.
     *
     * Requirements: 3.1, 3.2, 3.3, 3.4
     *
     * @param {object[]} txs - Array of transaction objects to render.
     */
    renderTransactionList(txs) {
      const listEl       = document.getElementById('transaction-list');
      const emptyEl      = document.getElementById('empty-state-transactions');

      if (!listEl) return;

      // Sort: newest date first; use createdAt as stable tie-breaker.
      const sorted = txs.slice().sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      if (sorted.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
      }

      if (emptyEl) emptyEl.hidden = true;

      listEl.innerHTML = sorted.map(tx => {
        const typeClass = tx.type === 'income' ? 'tx-income' : 'tx-expense';
        const amountStr = formatCurrency(tx.amount);
        // Format date for display: "YYYY-MM-DD" → locale-friendly string.
        const displayDate = tx.date
          ? new Date(tx.date + 'T00:00:00').toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
            })
          : '';

        return `
          <li class="tx-item ${typeClass}" data-id="${tx.id}">
            <div class="tx-info">
              <span class="tx-description">${_escapeHtml(tx.description)}</span>
              <span class="tx-meta">
                <span class="tx-category">${_escapeHtml(tx.category)}</span>
                <span class="tx-type">${_escapeHtml(tx.type)}</span>
                <span class="tx-date">${displayDate}</span>
              </span>
            </div>
            <div class="tx-actions">
              <span class="tx-amount">${amountStr}</span>
              <button
                class="btn-delete"
                type="button"
                data-id="${tx.id}"
                aria-label="Delete transaction: ${_escapeHtml(tx.description)}"
              >&times;</button>
            </div>
          </li>`.trim();
      }).join('');
    },

    // ── Doughnut chart ──────────────────────────────────────────────────────

    /**
     * Initialises or updates the Chart.js doughnut chart.
     *
     * - When `expenseMap` is empty, destroys any existing chart instance and
     *   shows the `#chart-placeholder` element instead.
     * - When Chart.js failed to load from CDN, shows `#chart-error` instead.
     * - On subsequent calls with data, updates the existing chart in-place
     *   (avoids flickering by calling `chart.update()` rather than recreating).
     *
     * Requirements: 5.2, 5.3, 5.4, 5.5
     *
     * @param {Map<string, number>} expenseMap - category → total expense amount
     */
    renderChart(expenseMap) {
      const canvas       = document.getElementById('expense-chart');
      const placeholder  = document.getElementById('chart-placeholder');
      const errorEl      = document.getElementById('chart-error');
      const legendEl     = document.getElementById('chart-legend');

      // Handle CDN load failure.
      if (window.__chartJsLoadFailed || typeof Chart === 'undefined') {
        if (canvas)      canvas.hidden      = true;
        if (placeholder) placeholder.hidden = true;
        if (errorEl)     errorEl.hidden     = false;
        if (legendEl)    legendEl.innerHTML = '';
        // Destroy any stale instance.
        if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
        return;
      }

      if (errorEl) errorEl.hidden = true;

      // Empty state.
      if (!expenseMap || expenseMap.size === 0) {
        if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
        if (canvas)      canvas.hidden      = true;
        if (placeholder) placeholder.hidden = false;
        if (legendEl)    legendEl.innerHTML = '';
        return;
      }

      // We have data — hide placeholder, show canvas.
      if (placeholder) placeholder.hidden = true;
      if (canvas)      canvas.hidden      = false;

      const allCats  = _allCategories();
      const labels   = [...expenseMap.keys()];
      const data     = labels.map(cat => expenseMap.get(cat));
      const colors   = labels.map(cat => getCategoryColor(cat, allCats));

      if (_chartInstance) {
        // Update existing chart in-place.
        _chartInstance.data.labels          = labels;
        _chartInstance.data.datasets[0].data   = data;
        _chartInstance.data.datasets[0].backgroundColor = colors;
        _chartInstance.update();
      } else {
        // Create a new chart.
        _chartInstance = new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: colors,
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }, // we render our own legend
              tooltip: {
                callbacks: {
                  label(ctx) {
                    const val = ctx.parsed;
                    return ` ${ctx.label}: ${formatCurrency(val)}`;
                  },
                },
              },
            },
          },
        });
      }

      // Render custom legend.
      if (legendEl) {
        legendEl.innerHTML = labels.map((cat, i) => `
          <li class="legend-item">
            <span class="legend-color" style="background:${colors[i]}" aria-hidden="true"></span>
            <span class="legend-label">${_escapeHtml(cat)}</span>
            <span class="legend-amount">${formatCurrency(data[i])}</span>
          </li>`.trim()
        ).join('');
      }
    },

    // ── Monthly summary ─────────────────────────────────────────────────────

    /**
     * Calculates and renders the monthly summary for the given year/month.
     *
     * Displays:
     *   - Total income for that month
     *   - Total expenses for that month
     *   - Net balance (income − expenses)
     *   - Per-category expense breakdown table
     *
     * Shows an empty-state message when no transactions exist for the month.
     *
     * Requirements: 8.3, 8.4, 8.5
     *
     * @param {number} year  - Four-digit year.
     * @param {number} month - 1-indexed month (1–12).
     */
    renderMonthlySummary(year, month) {
      const txs = State.getTransactionsForMonth(year, month);

      const incomeEl   = document.getElementById('summary-total-income');
      const expensesEl = document.getElementById('summary-total-expenses');
      const netEl      = document.getElementById('summary-net-balance');
      const bodyEl     = document.getElementById('summary-category-body');
      const emptyEl    = document.getElementById('summary-empty-state');
      const tableEl    = document.getElementById('summary-category-table');

      // Compute totals.
      const totalIncome   = txs.filter(t => t.type === 'income')
                               .reduce((s, t) => s + t.amount, 0);
      const totalExpenses = txs.filter(t => t.type === 'expense')
                               .reduce((s, t) => s + t.amount, 0);
      const netBalance    = totalIncome - totalExpenses;

      if (incomeEl)   incomeEl.textContent   = formatCurrency(totalIncome);
      if (expensesEl) expensesEl.textContent = formatCurrency(totalExpenses);
      if (netEl)      netEl.textContent      = formatCurrency(netBalance);

      // Empty state.
      if (txs.length === 0) {
        if (emptyEl)  emptyEl.hidden  = false;
        if (tableEl)  tableEl.hidden  = true;
        if (bodyEl)   bodyEl.innerHTML = '';
        return;
      }

      if (emptyEl)  emptyEl.hidden  = true;
      if (tableEl)  tableEl.hidden  = false;

      // Build per-category breakdown (expenses only).
      const categoryMap = new Map();
      txs.filter(t => t.type === 'expense').forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
      });

      if (bodyEl) {
        if (categoryMap.size === 0) {
          bodyEl.innerHTML = `
            <tr>
              <td colspan="3" class="empty-state">No expense transactions this month.</td>
            </tr>`;
        } else {
          bodyEl.innerHTML = [...categoryMap.entries()]
            .sort((a, b) => b[1] - a[1]) // highest expense first
            .map(([cat, amount]) => {
              const pct = totalExpenses > 0
                ? ((amount / totalExpenses) * 100).toFixed(1)
                : '0.0';
              return `
                <tr>
                  <td>${_escapeHtml(cat)}</td>
                  <td>${formatCurrency(amount)}</td>
                  <td>${pct}%</td>
                </tr>`.trim();
            }).join('');
        }
      }
    },

    // ── Notification helpers ────────────────────────────────────────────────

    /**
     * Shows the non-blocking storage-warning banner with the given message.
     *
     * Requirements: 6.9, 8.3
     *
     * @param {string} msg - Warning text to display.
     */
    showStorageWarning(msg) {
      const bannerEl  = document.getElementById('storage-warning');
      const messageEl = document.getElementById('storage-warning-message');
      if (messageEl) messageEl.textContent = msg;
      if (bannerEl)  bannerEl.hidden = false;
    },

    /**
     * Injects an inline validation error message adjacent to a form field.
     * The error element is expected to have `id="error-{field}"`.
     *
     * Sets `aria-describedby` on the field (preserving any existing value so
     * the static attribute from HTML is never lost) and `aria-invalid="true"`
     * so screen readers announce the error when the field is focused.
     *
     * Requirements: 2.3, 2.4
     *
     * @param {string} field - Field name (e.g., "description", "amount").
     * @param {string} msg   - Error message text.
     */
    showValidationError(field, msg) {
      const errorEl = document.getElementById(`error-${field}`);
      const fieldEl = document.getElementById(`tx-${field}`)
                   || document.getElementById(`new-${field}-name`);
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      if (fieldEl) {
        // Merge with any existing aria-describedby rather than overwriting it.
        const errorId = `error-${field}`;
        const existing = fieldEl.getAttribute('aria-describedby') || '';
        if (!existing.split(/\s+/).includes(errorId)) {
          const merged = existing ? `${existing} ${errorId}` : errorId;
          fieldEl.setAttribute('aria-describedby', merged);
        }
        fieldEl.setAttribute('aria-invalid', 'true');
      }
    },

    /**
     * Clears all inline validation error messages in the transaction form
     * and the category form, and resets `aria-invalid` on their inputs.
     * The static `aria-describedby` attributes (set in HTML) are preserved
     * since they permanently associate the error element with the input.
     *
     * Requirements: 2.3, 2.4
     */
    clearValidationErrors() {
      document.querySelectorAll('.validation-error').forEach(el => {
        el.textContent = '';
        el.hidden = true;
      });
      document.querySelectorAll('[aria-invalid]').forEach(el => {
        el.removeAttribute('aria-invalid');
      });
    },

    /**
     * Shows a transient toast notification for 3 seconds.
     *
     * @param {string} msg - Message to display.
     */
    showToast(msg) {
      const toastEl   = document.getElementById('toast');
      const messageEl = document.getElementById('toast-message');
      if (!toastEl) return;

      if (messageEl) messageEl.textContent = msg;
      toastEl.hidden = false;

      // Cancel any pending hide to restart the timer.
      if (_toastTimeout !== null) clearTimeout(_toastTimeout);
      _toastTimeout = setTimeout(() => {
        toastEl.hidden = true;
        _toastTimeout = null;
      }, 3000);
    },
  };
})();

/**
 * Escapes HTML special characters to prevent XSS when injecting
 * user-provided strings into innerHTML.
 *
 * @param {string} str - Raw string to escape.
 * @returns {string} HTML-safe string.
 */
function _escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.1 — Controller module
// Orchestrates State → Storage → Renderer and wires all DOM event listeners.
// ─────────────────────────────────────────────────────────────────────────────

const Controller = {
  // ── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Bootstraps the application:
   *   1. Detects OS theme preference for first-time users.
   *   2. Shows storage-warning banner if localStorage is unavailable.
   *   3. Populates year selector in the summary view.
   *   4. Rebuilds custom-category selectors from State.
   *   5. Sets the date field to today.
   *   6. Calls Renderer.init() to do the first full render.
   *   7. Registers all DOM event listeners.
   *
   * Requirements: 1.2, 6.5, 6.7, 9.2, 9.3, 9.4
   */
  init() {
    // ── 1. Apply theme (stored preference → OS preference → default "light") ──
    let theme = State.theme;
    if (!theme) {
      // First-time load — use OS preference (Req 9.3).
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
      State.theme = theme;
    }
    document.documentElement.setAttribute('data-theme', theme);

    // ── 2. Storage warning banner (Req 6.9) ────────────────────────────────
    if (!Storage.isAvailable()) {
      Renderer.showStorageWarning(
        'Local storage is unavailable. Your data will not be saved for this session.'
      );
    }

    // ── 3. Populate summary year selector ─────────────────────────────────
    this._populateYearSelector();

    // ── 4. Rebuild category selectors from custom categories in State ───────
    this._rebuildCategorySelectors();

    // ── 5. Default date field to today ─────────────────────────────────────
    const dateEl = document.getElementById('tx-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().slice(0, 10);
    }

    // ── 6. Initial render ───────────────────────────────────────────────────
    Renderer.init();

    // ── 7. Wire up all event listeners ─────────────────────────────────────
    this._registerEventListeners();

    // ── 8. Wire dismiss button for storage warning ──────────────────────────
    const dismissBtn = document.getElementById('btn-dismiss-warning');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const bannerEl = document.getElementById('storage-warning');
        if (bannerEl) bannerEl.hidden = true;
      });
    }
  },

  // ── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Processes the Add Transaction form submission.
   *
   * Flow:
   *   1. Extract field values from the form.
   *   2. Validate via State.addTransaction (returns error descriptor on failure).
   *   3. On failure: show inline validation error and return.
   *   4. On success: save to Storage, refresh UI, clear form.
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   *
   * @param {HTMLFormElement} form - The transaction form element.
   */
  handleAddTransaction(form) {
    Renderer.clearValidationErrors();

    const description = (form.elements['description']?.value ?? '').trim();
    const amountRaw   = form.elements['amount']?.value ?? '';
    const amount      = parseFloat(amountRaw);
    const type        = form.elements['type']?.value ?? 'expense';
    const category    = form.elements['category']?.value ?? BUILT_IN_CATEGORIES[0];
    const date        = form.elements['date']?.value ?? new Date().toISOString().slice(0, 10);

    const result = State.addTransaction({ description, amount, type, category, date });

    if (result.error) {
      Renderer.showValidationError(result.field, result.message);
      return;
    }

    // Persist to storage (non-blocking — storage may be unavailable).
    const storageResult = Storage.saveTransaction(result.tx);
    if (storageResult.error) {
      // Non-fatal: data is in memory, warn the user but don't rollback.
      Renderer.showStorageWarning(
        'Transaction saved in memory only — local storage write failed.'
      );
    }

    // Batch re-render via requestAnimationFrame (≤ 300 ms, Req 1.2).
    requestAnimationFrame(() => {
      Renderer.refresh();
    });

    // Reset form to defaults (Req 2.5).
    this._resetTransactionForm(form);
  },

  /**
   * Deletes the transaction identified by `id`.
   *
   * Flow:
   *   1. Take a snapshot via State.deleteTransaction (mutates in-memory state).
   *   2. Attempt Storage.deleteTransaction.
   *   3. On storage error: roll back state, show inline error on the row.
   *   4. On success: refresh UI.
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4
   *
   * @param {string} id - Transaction id to delete.
   */
  handleDeleteTransaction(id) {
    const { snapshot } = State.deleteTransaction(id);

    const storageResult = Storage.deleteTransaction(id);

    if (storageResult.error) {
      // Rollback in-memory state (Req 4.4).
      State.rollbackTransactions(snapshot);
      // Show inline error on the row (Req 4.4).
      const rowEl = document.querySelector(`[data-id="${id}"]`);
      if (rowEl) {
        // Insert an inline error span into the row if not already present.
        let errorSpan = rowEl.querySelector('.tx-delete-error');
        if (!errorSpan) {
          errorSpan = document.createElement('span');
          errorSpan.className = 'tx-delete-error validation-error';
          errorSpan.setAttribute('role', 'alert');
          rowEl.appendChild(errorSpan);
        }
        errorSpan.textContent = 'Could not delete — storage error. Please try again.';
        errorSpan.hidden = false;
      }
      return;
    }

    // Success — batch re-render (≤ 300 ms, Req 4.3).
    requestAnimationFrame(() => {
      Renderer.refresh();
    });
  },

  /**
   * Adds a custom category.
   *
   * Flow:
   *   1. Validate via State.addCustomCategory.
   *   2. On failure: show validation error on the category input.
   *   3. On success: persist, rebuild category selectors, clear the input.
   *
   * Requirements: 7.2, 7.3, 7.6
   *
   * @param {string} name - Proposed custom category name.
   * @param {HTMLInputElement} inputEl - The category name input element (for clearing).
   */
  handleAddCustomCategory(name, inputEl) {
    // Clear previous category validation error.
    const errorEl = document.getElementById('error-category');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    const inputField = document.getElementById('new-category-name');
    if (inputField) {
      inputField.removeAttribute('aria-invalid');
    }

    const result = State.addCustomCategory(name);

    if (result.error) {
      if (errorEl) {
        errorEl.textContent = result.message;
        errorEl.hidden = false;
      }
      if (inputField) {
        inputField.setAttribute('aria-describedby', 'error-category');
        inputField.setAttribute('aria-invalid', 'true');
      }
      return;
    }

    // Persist the updated custom category list.
    const storageResult = Storage.saveCustomCategories(State.customCategories);
    if (storageResult.error) {
      Renderer.showStorageWarning(
        'Custom category saved in memory only — local storage write failed.'
      );
    }

    // Rebuild all category selectors (Req 7.3).
    this._rebuildCategorySelectors();

    // Clear the input.
    const nameInput = document.getElementById('new-category-name');
    if (nameInput) nameInput.value = '';

    Renderer.showToast(`Category "${name.trim()}" added.`);
  },

  /**
   * Toggles the UI theme between 'light' and 'dark'.
   *
   * Requirements: 9.2, 9.4
   */
  handleThemeToggle() {
    const newTheme = State.theme === 'dark' ? 'light' : 'dark';
    State.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    Storage.saveTheme(newTheme);

    // Update toggle button emoji for visual feedback.
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
  },

  /**
   * Navigates to the Monthly Summary view.
   * Moves keyboard focus to the summary heading for screen readers.
   *
   * Requirements: 8.1, 8.2
   */
  handleNavigateToSummary() {
    const mainView    = document.getElementById('main-view');
    const summaryView = document.getElementById('summary-view');
    const navBtn      = document.getElementById('nav-summary');

    if (mainView)    mainView.hidden    = true;
    if (summaryView) summaryView.hidden = false;

    // Update aria-expanded state on the nav button.
    if (navBtn) navBtn.setAttribute('aria-expanded', 'true');

    // Move focus to the summary heading so screen readers announce the view change.
    const heading = document.getElementById('summary-view-heading');
    if (heading) heading.focus();

    // Render summary for the currently selected month/year.
    const { year, month } = this._getSelectedMonthYear();
    Renderer.renderMonthlySummary(year, month);
  },

  /**
   * Navigates back to the main transaction view.
   * Returns keyboard focus to the nav button that triggered the navigation.
   *
   * Requirements: 8.6
   */
  handleNavigateBack() {
    const mainView    = document.getElementById('main-view');
    const summaryView = document.getElementById('summary-view');
    const navBtn      = document.getElementById('nav-summary');

    if (summaryView) summaryView.hidden = true;
    if (mainView)    mainView.hidden    = false;

    // Update aria-expanded state on the nav button.
    if (navBtn) navBtn.setAttribute('aria-expanded', 'false');

    // Return focus to the Monthly Summary button so users don't lose their place.
    if (navBtn) navBtn.focus();
  },

  /**
   * Re-renders the monthly summary for the given year/month.
   *
   * Requirements: 8.3
   *
   * @param {number} year  - Four-digit year.
   * @param {number} month - 1-indexed month (1–12).
   */
  handleMonthChange(year, month) {
    Renderer.renderMonthlySummary(year, month);
  },

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Registers all DOM event listeners.
   *
   * Requirements: 2.1, 4.1, 7.2, 8.1, 8.2, 8.6, 9.2
   */
  _registerEventListeners() {
    // ── Transaction form submit ──────────────────────────────────────────────
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddTransaction(txForm);
      });
    }

    // ── Delete button delegation on #transaction-list ────────────────────────
    const txList = document.getElementById('transaction-list');
    if (txList) {
      txList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (!btn) return;
        const id = btn.dataset.id;
        if (id) this.handleDeleteTransaction(id);
      });
    }

    // ── Custom category form submit ───────────────────────────────────────────
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-category-name');
        const name = nameInput ? nameInput.value : '';
        this.handleAddCustomCategory(name, nameInput);
      });
    }

    // ── Theme toggle ─────────────────────────────────────────────────────────
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.handleThemeToggle());
    }

    // ── Navigation: main → summary ────────────────────────────────────────────
    const navSummary = document.getElementById('nav-summary');
    if (navSummary) {
      navSummary.addEventListener('click', () => this.handleNavigateToSummary());
    }

    // ── Navigation: summary → main ────────────────────────────────────────────
    const btnBack = document.getElementById('btn-back-main');
    if (btnBack) {
      btnBack.addEventListener('click', () => this.handleNavigateBack());
    }

    // ── Month/year selectors in summary view ──────────────────────────────────
    const monthSel = document.getElementById('summary-month');
    const yearSel  = document.getElementById('summary-year');

    const onMonthYearChange = () => {
      const { year, month } = this._getSelectedMonthYear();
      this.handleMonthChange(year, month);
    };

    if (monthSel) monthSel.addEventListener('change', onMonthYearChange);
    if (yearSel)  yearSel.addEventListener('change', onMonthYearChange);

    // ── Clear validation errors on input focus ────────────────────────────────
    ['tx-description', 'tx-amount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('focus', () => {
          const errEl = document.getElementById(`error-${id.replace('tx-', '')}`);
          if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
          el.removeAttribute('aria-invalid');
        });
      }
    });

    const newCatInput = document.getElementById('new-category-name');
    if (newCatInput) {
      newCatInput.addEventListener('focus', () => {
        const errEl = document.getElementById('error-category');
        if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
        newCatInput.removeAttribute('aria-invalid');
      });
    }
  },

  /**
   * Resets the transaction form to its default state after a successful add.
   *
   * Requirements: 2.5
   *
   * @param {HTMLFormElement} form
   */
  _resetTransactionForm(form) {
    const descEl  = form.elements['description'];
    const amtEl   = form.elements['amount'];
    const typeEl  = form.elements['type'];
    const catEl   = form.elements['category'];
    const dateEl  = form.elements['date'];

    if (descEl)  descEl.value  = '';
    if (amtEl)   amtEl.value   = '';
    if (typeEl)  typeEl.value  = 'expense';
    if (catEl)   catEl.value   = BUILT_IN_CATEGORIES[0];
    if (dateEl)  dateEl.value  = new Date().toISOString().slice(0, 10);

    Renderer.clearValidationErrors();
  },

  /**
   * Rebuilds the custom-category `<optgroup>` in `#tx-category` and the
   * filter `#category-select-filter` (if present), and refreshes the
   * `#custom-category-list` display in the category management section.
   *
   * Requirements: 7.3, 6.7, 7.6
   */
  _rebuildCategorySelectors() {
    const customCats = State.customCategories;

    // ── #tx-category custom optgroup ─────────────────────────────────────────
    const customGroup = document.getElementById('custom-category-group');
    if (customGroup) {
      customGroup.innerHTML = customCats
        .map(cat => `<option value="${_escapeHtml(cat)}">${_escapeHtml(cat)}</option>`)
        .join('');
    }

    // ── #category-select-filter (filter control, if it exists) ───────────────
    const filterSel = document.getElementById('category-select-filter');
    if (filterSel) {
      // Preserve the "All" option if present, then rebuild the rest.
      const allOption = filterSel.querySelector('option[value=""]');
      filterSel.innerHTML = '';
      if (allOption) filterSel.appendChild(allOption);

      [...BUILT_IN_CATEGORIES, ...customCats].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterSel.appendChild(opt);
      });
    }

    // ── #custom-category-list display ────────────────────────────────────────
    const listEl  = document.getElementById('custom-category-list');
    const emptyEl = document.getElementById('empty-state-categories');

    if (listEl) {
      if (customCats.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        listEl.innerHTML = customCats
          .map(cat => `<li class="custom-category-item">${_escapeHtml(cat)}</li>`)
          .join('');
      }
    }
  },

  /**
   * Populates the `#summary-year` selector with a range of years.
   *
   * Builds the range from the earliest transaction year (or the current year
   * if there are no transactions) to the current year. Always includes at
   * least the current year.
   *
   * Requirements: 8.2
   */
  _populateYearSelector() {
    const yearSel = document.getElementById('summary-year');
    if (!yearSel) return;

    const now = new Date();
    const currentYear = now.getFullYear();

    // Find earliest transaction year.
    let minYear = currentYear;
    State.transactions.forEach(tx => {
      if (typeof tx.date === 'string' && tx.date.length >= 4) {
        const y = parseInt(tx.date.slice(0, 4), 10);
        if (!isNaN(y) && y < minYear) minYear = y;
      }
    });

    yearSel.innerHTML = '';
    for (let y = currentYear; y >= minYear; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === currentYear) opt.selected = true;
      yearSel.appendChild(opt);
    }
  },

  /**
   * Reads the currently selected month and year from the summary selectors.
   *
   * @returns {{ year: number, month: number }}
   */
  _getSelectedMonthYear() {
    const monthSel = document.getElementById('summary-month');
    const yearSel  = document.getElementById('summary-year');

    const now   = new Date();
    const month = monthSel ? parseInt(monthSel.value, 10) : now.getMonth() + 1;
    const year  = yearSel  ? parseInt(yearSel.value,  10) : now.getFullYear();

    return { year, month };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap — kick everything off once the DOM is ready.
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Controller.init();
});
