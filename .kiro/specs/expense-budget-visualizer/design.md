# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a single-page, client-only web application delivered as three files: `index.html`, `style.css`, and `app.js`. It requires no server, no build step, and no user accounts. All persistent state is stored in the browser's `localStorage` API. The app lets users record income and expense transactions, see a running balance, browse a color-coded transaction history, visualize spending by category with a doughnut chart, create custom categories, review monthly summaries, and toggle between dark and light themes.

Because the entire application runs in a single browser session with no network calls, all state management, rendering, and persistence happen synchronously in `app.js`. The design prioritizes simplicity: a thin event-driven controller coordinates three main modules — state, rendering, and storage.

**Delivery targets**: Modern browsers (Chrome, Firefox, Edge, Safari) in both standalone-page and browser-extension contexts.

---

## Architecture

The app follows a three-layer architecture inside a single JavaScript file:

```
┌────────────────────────────────────────────────────────┐
│                        UI Layer                        │
│  index.html  +  style.css  (DOM, CSS custom properties)│
└─────────────────────────┬──────────────────────────────┘
                          │ DOM events / render calls
┌─────────────────────────▼──────────────────────────────┐
│                   Controller (app.js)                  │
│  • Event listeners (form submit, delete, nav, theme)   │
│  • Orchestrates State → Storage → Renderer pipeline    │
└──────────┬────────────────────────────┬────────────────┘
           │                            │
┌──────────▼──────────┐   ┌─────────────▼──────────────┐
│   State Module      │   │      Storage Module         │
│  (in-memory arrays) │   │  (localStorage read/write)  │
└──────────┬──────────┘   └─────────────────────────────┘
           │
┌──────────▼──────────┐
│   Renderer Module   │
│  (DOM mutations,    │
│   Chart.js calls)   │
└─────────────────────┘
```

**Key design decisions:**

- **No framework**: Plain ES2020 JavaScript keeps the deliverable small and extension-safe.
- **Chart.js (CDN)**: Provides the doughnut chart without reinventing canvas rendering. Loaded from a stable CDN with an `integrity` attribute; the app degrades gracefully if the CDN is unavailable.
- **CSS custom properties for theming**: A single `data-theme` attribute on `<html>` switches between light and dark palettes, eliminating JavaScript color manipulation.
- **`requestAnimationFrame` / micro-task batching**: Balance and chart updates triggered by add/delete are batched so that a single user action results in exactly one re-render cycle (≤ 300 ms).

### Module Interaction Flow

```
User action (e.g., "Add Transaction")
    │
    ▼
Controller.handleAddTransaction()
    ├─► State.addTransaction(tx)       – update in-memory list
    ├─► Storage.saveTransaction(tx)    – write to localStorage
    └─► Renderer.refresh()
            ├─► renderBalance()
            ├─► renderTransactionList()
            └─► renderChart()
```

---

## Components and Interfaces

### 1. State Module (`State`)

Holds in-memory copies of all persistent data loaded at startup.

```js
State = {
  transactions: Transaction[],       // all recorded transactions
  customCategories: string[],        // user-defined category names
  theme: 'light' | 'dark',
  // derived (not stored, computed on demand)
  getBalance():     number,
  getTotalIncome(): number,
  getTotalExpenses(): number,
  getExpensesByCategory(): Map<string, number>,
  getTransactionsForMonth(year: number, month: number): Transaction[],
}
```

### 2. Storage Module (`Storage`)

Thin wrapper around `localStorage` with error isolation.

```js
Storage = {
  loadAll(): { transactions, customCategories, theme },
  saveTransaction(tx: Transaction): void,
  deleteTransaction(id: string): void,
  saveCustomCategories(cats: string[]): void,
  saveTheme(theme: string): void,
}
```

All Storage methods catch exceptions and surface them via a returned error flag rather than throwing, allowing the Controller to show the non-blocking warning banner.

### 3. Renderer Module (`Renderer`)

Owns all DOM mutations and the Chart.js instance.

```js
Renderer = {
  init(): void,                          // initial full render on page load
  refresh(): void,                       // after any state change
  renderBalance(): void,
  renderTransactionList(txs: Transaction[]): void,
  renderChart(expenseMap: Map<string, number>): void,
  renderMonthlySummary(year, month): void,
  showStorageWarning(msg: string): void,
  showValidationError(field: string, msg: string): void,
  clearValidationErrors(): void,
}
```

### 4. Controller (`Controller`)

Wires together event listeners and the three modules above.

```js
Controller = {
  init(): void,
  handleAddTransaction(formData: FormData): void,
  handleDeleteTransaction(id: string): void,
  handleAddCustomCategory(name: string): void,
  handleThemeToggle(): void,
  handleNavigateToSummary(): void,
  handleNavigateBack(): void,
  handleMonthChange(year: number, month: number): void,
}
```

### 5. HTML Structure

```
<html data-theme="light|dark">
  <head> … </head>
  <body>
    <header>                       ← Balance summary + theme toggle
      <div id="balance-summary">
        <span id="balance">
        <span id="total-income">
        <span id="total-expenses">
      </div>
      <button id="theme-toggle" aria-label="Toggle dark/light mode">
      <button id="nav-summary">    ← "Monthly Summary" navigation
    </header>

    <main id="main-view">
      <section id="form-section">  ← Add Transaction form
      <section id="list-section">  ← Transaction_List + empty state
    </main>

    <section id="chart-section">   ← Doughnut chart + legend
    <section id="summary-view" hidden> ← Monthly Summary
    <section id="category-section">   ← Custom Category management

    <div id="storage-warning" role="alert" hidden>
    <div id="toast" aria-live="polite" hidden>
  </body>
</html>
```

---

## Data Models

### Transaction

```ts
interface Transaction {
  id: string; // UUID or timestamp-based unique identifier
  description: string; // non-empty, user-provided label
  amount: number; // positive float, stored as number (not string)
  type: "income" | "expense";
  category: string; // built-in or custom category name
  date: string; // ISO 8601 date string "YYYY-MM-DD"
  createdAt: number; // Date.now() at insertion time (for tie-breaking)
}
```

**localStorage key**: `"ebv_transactions"` — serialized as `JSON.stringify(Transaction[])`.

### Custom Categories

```ts
type CustomCategories = string[]; // max 50 entries, each 1–50 chars
```

**localStorage key**: `"ebv_custom_categories"` — serialized as `JSON.stringify(string[])`.

### Theme Preference

```ts
type Theme = "light" | "dark";
```

**localStorage key**: `"ebv_theme"` — stored as a bare string (no JSON wrapper needed).

### Built-in Categories (constant, not stored)

```
['Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Bills', 'Other']
```

### Derived: Expense Map (in-memory only)

```ts
type ExpenseMap = Map<string, number>; // category → total amount
```

Computed by `State.getExpensesByCategory()` on demand; never persisted.

### Category Color Map (in-memory only)

```ts
type CategoryColorMap = Map<string, string>; // category → CSS hex color
```

Pre-assigned from a fixed palette for built-in categories; additional colors are assigned deterministically from the palette by index for custom categories. The map is rebuilt from the same palette on every session so colors remain stable within and across sessions for the same category name.

```
Fixed palette (cyclic):
['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF',
 '#FF9F40','#FF6384','#C9CBCF','#7BC8A4','#E8A838']
```

---

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

> **Property Reflection Summary**: All 50 acceptance criteria across 10 requirements were analyzed in prework. Requirements 1.3 and 1.4 (currency formatting for balance, income, and expenses) were consolidated into a single formatting property (P2). Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 are each covered by the corresponding round-trip or persistence property (P3, P4, P14, P10) with cross-references. All 14 final properties are logically distinct and non-redundant.

---

### Property 1: Balance computation correctness

_For any_ list of transactions (with any combination of amounts, income types, and expense types), the computed balance SHALL equal the arithmetic sum of all income amounts minus the arithmetic sum of all expense amounts in that list.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Currency formatting correctness

_For any_ numeric value representing a balance, total income, or total expenses, the formatted string produced by the currency formatter SHALL match the pattern `$X,XXX.XX` — a dollar sign, comma-separated thousands, and exactly two decimal places — for all finite numbers.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Transaction persistence round-trip

_For any_ valid transaction (non-empty description, positive amount, valid type/category/date), after it is added the Storage module SHALL write it to localStorage such that reading all transactions back from localStorage produces a list whose fields are equal to the saved transaction.

**Validates: Requirements 2.2, 6.2**

---

### Property 4: Delete removes from state and storage

_For any_ non-empty transaction list, after a transaction is deleted the resulting transaction list SHALL NOT contain that transaction, and re-reading transactions from localStorage SHALL also NOT yield that transaction.

**Validates: Requirements 4.2, 4.3, 6.3**

---

### Property 5: Empty / whitespace description is rejected

_For any_ string composed entirely of whitespace characters (including the zero-length empty string), attempting to add a transaction with that description SHALL be rejected, and the transaction list SHALL remain unchanged before and after the attempt.

**Validates: Requirements 2.3**

---

### Property 6: Non-positive amount is rejected

_For any_ amount value that is zero, strictly negative, or non-numeric (NaN, non-numeric strings), attempting to add a transaction with that amount SHALL be rejected, and the transaction list SHALL remain unchanged before and after the attempt.

**Validates: Requirements 2.4**

---

### Property 7: Unique transaction identifiers

_For any_ sequence of N successive transaction additions (N ≥ 2), the identifiers assigned to those transactions SHALL be pairwise distinct — no two transactions in the resulting list share the same id.

**Validates: Requirements 2.6**

---

### Property 8: Chart expense map consistency

_For any_ list of expense transactions, the expense map produced by `State.getExpensesByCategory()` SHALL contain exactly the set of category names present in those transactions as keys, and each key's associated value SHALL equal the arithmetic sum of amounts for all transactions belonging to that category.

**Validates: Requirements 5.1, 5.2**

---

### Property 9: Custom category validation

_For any_ candidate category name that is the empty string, exceeds 50 characters in length, or is identical (case-insensitively) to an existing built-in or custom category name, attempting to save it SHALL be rejected and the custom category list SHALL remain unchanged.

**Validates: Requirements 7.5**

---

### Property 10: Custom category persistence round-trip

_For any_ valid custom category name (1–50 characters, not case-insensitively matching any existing category), after it is saved the custom category list in localStorage SHALL contain that name, and subsequently loading the app SHALL include that name in every category selector and filter control.

**Validates: Requirements 7.3, 7.4, 6.6, 6.7**

---

### Property 11: Monthly summary computation correctness

_For any_ set of transactions and any month/year selection, the monthly summary SHALL display: total income equal to the sum of income-type transaction amounts dated within that month, total expenses equal to the sum of expense-type transaction amounts dated within that month, and net balance equal to that monthly income minus those monthly expenses.

**Validates: Requirements 8.3**

---

### Property 12: Transaction list sort order

_For any_ list of transactions with varying dates, the rendered Transaction_List SHALL display them in reverse-chronological order by transaction date — the most recently dated transaction is rendered first.

**Validates: Requirements 3.4**

---

### Property 13: localStorage malformed data is discarded gracefully

_For any_ string value that is not valid JSON injected as the stored value of any localStorage key used by the app, calling `Storage.loadAll()` SHALL return the default empty value for that key and SHALL NOT throw an uncaught exception, allowing the app to continue loading normally.

**Validates: Requirements 6.8**

---

### Property 14: Theme persistence round-trip

_For any_ theme value in `{'light', 'dark'}`, after the user activates the theme toggle and the preference is written to localStorage, reading that key back SHALL return the same theme value, and the app's `<html>` element's `data-theme` attribute SHALL reflect that value on the subsequent page load.

**Validates: Requirements 9.2, 9.4, 6.4, 6.5**

---

## Error Handling

### localStorage Unavailability

- Detected once at app startup by calling a probe write/read/delete inside a `try/catch`.
- If unavailable, a non-blocking banner (`#storage-warning`) is shown, and the app continues with in-memory state only.
- Subsequent Storage calls are no-ops that return an error flag; the Controller ignores the flag when storage is already known unavailable.

### Malformed localStorage Data

- Each `JSON.parse` call in `Storage.loadAll()` is wrapped in its own `try/catch`.
- A parse failure discards that key's data, logs a `console.warn`, and returns the default empty value.
- No error is surfaced to the user for this case; the app continues normally.

### Transaction Deletion Failure

- If `localStorage.setItem` throws during deletion (e.g., quota exceeded after re-serialization), the Storage module returns an error flag.
- The Controller catches this flag and renders an inline error on the affected transaction row (Req 4.4).
- The in-memory state is rolled back to keep UI and storage consistent.

### Chart.js CDN Unavailability

- A `window.onerror` / `<script onerror>` handler detects Chart.js load failure.
- The chart area displays a fallback message: "Chart unavailable — unable to load chart library."
- All other features continue to function.

### Form Validation Errors

- Inline error messages are rendered adjacent to the offending field using `aria-describedby` links so screen readers announce them.
- All validation errors are cleared on the next successful form submission or on focus of the corrected field.

---

## Testing Strategy

### Overall Approach

Because this is a pure client-side JavaScript application with no build pipeline, tests are written in plain JavaScript using **Vitest** (zero-config, ESM-native) with **jsdom** for DOM simulation.

Property-based tests use **fast-check** to generate random inputs over large input spaces.

### Unit Tests (Example-Based)

Focus on specific examples, edge cases, and integration points:

| Area                       | Tests                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `Storage.loadAll()`        | Parses valid JSON; discards malformed keys; handles missing keys; catches localStorage exceptions |
| `Renderer.renderBalance()` | Formats "$1,234.56", "$0.00", negative balance                                                    |
| Built-in categories        | Correct 7-item list; colors are stable within a session                                           |
| Monthly summary routing    | Navigating to summary hides main view; navigating back restores main view                         |
| Empty-state messages       | Transaction list and chart area show correct messages when empty                                  |
| Theme application          | `data-theme` attribute flips on toggle; saved and restored on reload                              |

### Property-Based Tests

Each property test uses **fast-check** with a minimum of **100 iterations**.

Each test is tagged with a comment referencing its design property:

```js
// Feature: expense-budget-visualizer, Property N: <property text>
```

| Property                                     | Generator inputs                                                    | Assertion                                                  |
| -------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| **P1** Balance correctness                   | `fc.array(transactionArb)`                                          | `getBalance() === sum(income) - sum(expenses)`             |
| **P2** Currency formatting                   | `fc.float({min: -1e9, max: 1e9})`                                   | formatted string matches `$X,XXX.XX` pattern               |
| **P3** Transaction persistence round-trip    | `transactionArb`                                                    | Re-read from storage contains saved tx                     |
| **P4** Delete removes from state and storage | `fc.array(transactionArb, {minLength:1})` + random index            | tx absent after delete from both state and storage         |
| **P5** Whitespace description rejected       | `fc.string().filter(s => s.trim() === '')`                          | addTransaction returns error; list unchanged               |
| **P6** Non-positive amount rejected          | `fc.oneof(fc.constant(0), fc.float({max:-0.01}), fc.constant(NaN))` | addTransaction returns error; list unchanged               |
| **P7** Unique IDs                            | `fc.integer({min:2, max:100})` → add N transactions                 | `new Set(ids).size === N`                                  |
| **P8** Expense map consistency               | `fc.array(expenseTxArb)`                                            | map keys === distinct categories; values === category sums |
| **P9** Custom category validation            | `fc.oneof(emptyNameArb, longNameArb, duplicateNameArb)`             | addCustomCategory returns error; list unchanged            |
| **P10** Custom category persistence          | `validCategoryNameArb`                                              | saved name present in re-loaded selectors                  |
| **P11** Monthly summary correctness          | `fc.array(transactionArb)` + `fc.record({month, year})`             | summary totals match manual sums filtered to that month    |
| **P12** Transaction list sort order          | `fc.array(transactionArb)` with distinct dates                      | rendered order = reverse-chronological                     |
| **P13** Malformed data discarded             | `fc.string()` injected as JSON value                                | `loadAll()` returns defaults; no exception thrown          |
| **P14** Theme persistence round-trip         | `fc.constantFrom('light', 'dark')`                                  | saved theme read back correctly; `data-theme` matches      |

### Accessibility Testing

- Automated: **axe-core** integrated into Vitest/jsdom suite to check for WCAG AA violations on rendered DOM snapshots.
- Manual checklist: keyboard navigation order, screen-reader announcement of live regions (`aria-live="polite"` for toast, `role="alert"` for storage warning), contrast ratios verified against the CSS custom-property palette.

### Browser Compatibility

- Automated: **Playwright** smoke tests in Chrome, Firefox, and WebKit cover:
  - Page loads without console errors
  - Add transaction → balance updates
  - Delete transaction → balance updates
  - Theme toggle → `data-theme` changes
  - Refresh → data persists
