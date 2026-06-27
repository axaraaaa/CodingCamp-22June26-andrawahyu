# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a single-page, client-only web app delivered as `index.html`, `style.css`, and `app.js`. No build step is required. The implementation follows the three-layer architecture (State → Storage → Renderer, orchestrated by a Controller) defined in the design, with Vitest + fast-check for property-based tests and jsdom for DOM simulation.

## Tasks

- [x] 1. Scaffold project files and set up testing infrastructure
  - Create `index.html` with the full HTML skeleton (header, main, chart-section, summary-view, category-section, storage-warning, toast) and all required `id` attributes from the design
  - Create an empty `style.css` and an empty `app.js` as stubs
  - Initialise a `package.json` and install Vitest, jsdom, and fast-check as dev dependencies
  - Create `vitest.config.js` configured with the jsdom environment
  - Create a `tests/` directory with a placeholder `setup.js` file
  - _Requirements: 6.1_

- [x] 2. Implement the Storage module
  - [x] 2.1 Write the `Storage` module in `app.js`
    - Implement `Storage.loadAll()` — reads `ebv_transactions`, `ebv_custom_categories`, and `ebv_theme` from `localStorage`; wraps each `JSON.parse` in its own `try/catch`; returns defaults on failure
    - Implement `Storage.saveTransaction(tx)`, `Storage.deleteTransaction(id)`, `Storage.saveCustomCategories(cats)`, and `Storage.saveTheme(theme)` — each catches exceptions and returns an error flag instead of throwing
    - Probe `localStorage` availability at module initialisation; set an internal flag used by all write methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.8, 6.9_

- [x] 3. Implement the State module
  - [x] 3.1 Write the `State` module in `app.js`
    - Define `State.transactions`, `State.customCategories`, and `State.theme` as in-memory collections populated by `Storage.loadAll()` at startup
    - Implement `State.getBalance()`, `State.getTotalIncome()`, `State.getTotalExpenses()` using `Array.reduce`
    - Implement `State.getExpensesByCategory()` returning a `Map<string, number>`
    - Implement `State.getTransactionsForMonth(year, month)` filtering by ISO date string
    - Implement `State.addTransaction(tx)` — validates non-empty trimmed description and positive finite amount; pushes to array on success; returns error descriptor on failure
    - Implement `State.deleteTransaction(id)` — splices the matching entry; returns rollback snapshot for error recovery
    - Implement `State.addCustomCategory(name)` — validates not-empty, ≤ 50 chars, case-insensitively unique; pushes on success; returns error on failure
    - _Requirements: 1.1, 1.2, 2.3, 2.4, 2.6, 4.2, 5.1, 7.5, 8.3_

- [ ] 4. Checkpoint — run all State and Storage tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the Renderer module
  - [x] 5.1 Write `Renderer.init()` and `Renderer.refresh()` in `app.js`
    - Implement `Renderer.renderBalance()` — formats balance, total income, and total expenses via a shared `formatCurrency(n)` helper and injects into `#balance`, `#total-income`, `#total-expenses`
    - Implement `Renderer.renderTransactionList(txs)` — sorts by transaction date descending, renders each row with description, amount, category, type, and date; applies income/expense color class; adds a delete button; shows empty-state message when `txs` is empty
    - Implement `Renderer.renderChart(expenseMap)` — initialises or updates a Chart.js doughnut chart using the category color map; shows placeholder text when `expenseMap` is empty; handles Chart.js CDN unavailability with a fallback message
    - Implement `Renderer.renderMonthlySummary(year, month)` — calculates and displays total income, total expenses, net balance, and per-category breakdown table for the selected month; shows empty-state message when no transactions exist for that month
    - Implement `Renderer.showStorageWarning(msg)`, `Renderer.showValidationError(field, msg)`, `Renderer.clearValidationErrors()`, and toast notification helpers
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 8.3, 8.4, 8.5_

- [x] 6. Implement CSS styling and theming
  - [x] 6.1 Write `style.css` with CSS custom properties for both themes
    - Define `[data-theme="light"]` and `[data-theme="dark"]` variable blocks for all color tokens (background, surface, text, income-color, expense-color, border, etc.)
    - Implement single-column layout for viewports ≤ 375 px and two-column form/list layout for viewports ≥ 768 px using CSS Grid or Flexbox
    - Set all font sizes in `rem`, minimum body font size 12 px; set all touch targets to minimum 44 × 44 CSS px via padding/min-height
    - Verify contrast ratios for both themes meet WCAG AA (4.5:1 body text, 3:1 large text and UI boundaries)
    - _Requirements: 9.1, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4_

- [ ] 7. Implement the Controller and wire everything together
  - [ ] 7.1 Write the `Controller` module in `app.js`
    - Implement `Controller.init()` — calls `Storage.loadAll()`, populates `State`, then calls `Renderer.init()`; shows storage warning banner if localStorage unavailable
    - Implement `Controller.handleAddTransaction(formData)` — validates via `State.addTransaction`; on success calls `Storage.saveTransaction` then `Renderer.refresh()`; on failure calls `Renderer.showValidationError`; clears form on success
    - Implement `Controller.handleDeleteTransaction(id)` — calls `State.deleteTransaction` for snapshot, then `Storage.deleteTransaction`; on storage error rolls back state and calls `Renderer.showValidationError` on the row; on success calls `Renderer.refresh()`
    - Implement `Controller.handleAddCustomCategory(name)` — validates via `State.addCustomCategory`; on success calls `Storage.saveCustomCategories` then rebuilds category selectors via Renderer; on failure shows validation error
    - Implement `Controller.handleThemeToggle()` — toggles `State.theme`, writes `<html data-theme>`, calls `Storage.saveTheme`
    - Implement `Controller.handleNavigateToSummary()` and `Controller.handleNavigateBack()` — toggles `#main-view` / `#summary-view` visibility
    - Implement `Controller.handleMonthChange(year, month)` — calls `Renderer.renderMonthlySummary`
    - Register all DOM event listeners (form submit, delete buttons via delegation, category form submit, theme toggle, nav buttons, month/year selectors)
    - Implement OS-preference theme detection via `prefers-color-scheme` for first-time load
    - Batch balance + chart re-renders using `requestAnimationFrame` to ensure ≤ 300 ms update
    - _Requirements: 1.2, 2.1, 2.2, 2.5, 4.1, 4.4, 6.5, 6.7, 7.2, 7.3, 7.6, 8.1, 8.2, 8.6, 9.2, 9.3, 9.4, 9.7_

  - [x] 7.2 Add Chart.js CDN `<script>` tag to `index.html` with `integrity` attribute and `onerror` handler for graceful degradation
    - _Requirements: 5.1, 5.5_

- [ ] 8. Checkpoint — run full test suite and verify all modules are wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement built-in category list and category color map
  - [x] 9.1 Add the seven built-in categories constant and the 10-color fixed palette to `app.js`
    - Export `BUILT_IN_CATEGORIES` array and `getCategoryColor(name)` helper that assigns colors deterministically by cycling through the fixed palette
    - Populate the Add Transaction form's category `<select>` and Custom Category section with built-in entries on init
    - _Requirements: 7.1, 7.6, 5.3_

- [x] 10. Implement accessibility enhancements
  - [x] 10.1 Add ARIA attributes and keyboard support across all interactive elements
    - Link validation error messages to their fields via `aria-describedby`
    - Ensure `role="alert"` on `#storage-warning` and `aria-live="polite"` on `#toast`
    - Verify keyboard focus order is logical for form, transaction list, chart, summary, and category sections
    - _Requirements: 9.1, 2.3, 2.4, 4.4_

- [ ] 11. Write unit tests for example-based scenarios

- [ ] 12. Final checkpoint — run all tests and verify browser behavior
  - Ensure all Vitest tests pass (`vitest --run`), ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests (P1–P14) validate universal correctness properties from the design; each is a separate sub-task with its property number annotated
- Unit tests validate specific examples, edge cases, and DOM integration
- The three-file delivery (`index.html`, `style.css`, `app.js`) requires no build step; Vitest is a dev-only tool

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "9.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] },
    {
      "id": 3,
      "tasks": [
        "3.2",
        "3.3",
        "3.4",
        "3.5",
        "3.6",
        "3.7",
        "3.8",
        "3.9",
        "3.10",
        "5.1"
      ]
    },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
