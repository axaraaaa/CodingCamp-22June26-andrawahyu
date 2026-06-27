// tests/setup.js — Global test setup for Expense & Budget Visualizer
// This file is loaded by Vitest before each test file (configured in vitest.config.js).

// Clear localStorage before each test to ensure test isolation.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
