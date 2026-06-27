# Requirements Document

## Introduction

The Expense & Budget Visualizer is a mobile-friendly web application that helps users track daily spending without requiring a backend server or user account. It runs entirely in the browser, persists data using the Local Storage API, and presents spending information through a clean, minimal interface. The app displays a running balance, a transaction history list, and a doughnut/bar chart of spending broken down by category. Three optional enhancements are included: user-defined custom categories, a monthly summary view, and a dark/light mode toggle.

The application is delivered as a single-page HTML file with one external CSS file and one external JavaScript file, and must function in all modern browsers (Chrome, Firefox, Edge, Safari) as both a standalone web page and a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single financial event recorded by the user, containing an amount, a category, a description, a type (income or expense), and a timestamp.
- **Balance**: The running total calculated as the sum of all income transactions minus the sum of all expense transactions stored in Local Storage.
- **Category**: A label grouping transactions of similar nature (e.g., Food, Transport, Entertainment). Can be a built-in category or a user-defined custom category.
- **Custom_Category**: A category name created by the user that does not exist in the default category list.
- **Chart**: A visual graphic (doughnut or bar) that represents spending amounts grouped by category for a selected time period.
- **Monthly_Summary**: A view showing aggregated income, total expenses, net balance, and per-category spending totals for a calendar month selected by the user.
- **Local_Storage**: The browser's built-in `localStorage` API used to persist transaction and settings data client-side.
- **Theme**: The visual color scheme of the App, either "light" or "dark".
- **Transaction_List**: The scrollable list of all recorded transactions displayed in the main view.
- **Sort_Order**: The current ordering applied to the Transaction_List (default: newest first).
- **Budget_Limit**: Not implemented in this version (optional challenge 4 was not selected).

---

## Requirements

### Requirement 1: Display Balance Summary

**User Story:** As a user, I want to see my current balance at a glance, so that I know immediately how much money I have available.

#### Acceptance Criteria

1. THE App SHALL calculate and display the Balance as the sum of all income Transaction amounts minus the sum of all expense Transaction amounts stored in Local_Storage.
2. WHEN a Transaction is added or deleted, THE App SHALL recalculate and update the displayed Balance within 300 ms without requiring a page reload.
3. THE App SHALL display the Balance formatted with a currency symbol and two decimal places (e.g., "$1,234.56").
4. THE App SHALL display the total income and total expenses as separate summary figures alongside the Balance, each formatted with a currency symbol and two decimal places.
5. IF Local_Storage is unavailable or returns a read error on page load, THEN THE App SHALL display the Balance, total income, and total expenses as zero.

---

### Requirement 2: Add a Transaction

**User Story:** As a user, I want to add a new income or expense transaction, so that I can keep my spending history up to date.

#### Acceptance Criteria

1. THE App SHALL provide a form with the following fields: description (text, required), amount (positive number, required), type (income or expense, required), category (selectable from built-in and custom categories, required), and date (date picker, defaults to today's date).
2. WHEN the user submits the form with all required fields filled with valid values, THE App SHALL save the Transaction to Local_Storage and update the Balance and Transaction_List within 300 ms without requiring a page reload.
3. IF the user submits the form with an empty description, THEN THE App SHALL display an inline validation error adjacent to the description field and prevent saving the Transaction.
4. IF the user submits the form with an amount that is not a positive number (zero, negative, or non-numeric), THEN THE App SHALL display an inline validation error adjacent to the amount field and prevent saving the Transaction.
5. WHEN a Transaction is saved successfully, THE App SHALL clear the form fields and reset them to their default values (empty description, empty amount, type defaults to "expense", category defaults to first built-in category, date defaults to today).
6. THE App SHALL assign a unique identifier (UUID or timestamp-based) to each Transaction at the time of creation, such that no two Transactions share the same identifier.

---

### Requirement 3: View Transaction History

**User Story:** As a user, I want to see a list of all my transactions, so that I can review my spending and income over time.

#### Acceptance Criteria

1. THE App SHALL display all Transactions stored in Local_Storage in the Transaction_List, showing the description, amount, category, type, and transaction date for each entry.
2. THE App SHALL render each Transaction in the Transaction_List with a color indicator that differs between income Transactions and expense Transactions, such that the type of any Transaction is identifiable by color alone without reading the type field.
3. WHEN Local_Storage contains no Transactions, THE App SHALL display an empty-state message in the Transaction_List area indicating that no transactions have been recorded.
4. THE App SHALL display Transactions in reverse-chronological order by transaction date, with the most recently dated Transaction appearing first.
5. IF Local_Storage is unavailable or returns a read error, THEN THE App SHALL display an error message in the Transaction_List area indicating that transactions could not be loaded.

---

### Requirement 4: Delete a Transaction

**User Story:** As a user, I want to delete a transaction, so that I can remove incorrect or duplicate entries.

#### Acceptance Criteria

1. THE App SHALL provide a dedicated interactive delete control (e.g., a button or icon) on each Transaction entry in the Transaction_List.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL remove that Transaction from Local_Storage and remove the corresponding entry from the Transaction_List within 300 ms without requiring a page reload.
3. WHEN a Transaction is deleted, THE App SHALL recalculate and update the Balance within 300 ms.
4. IF Local_Storage throws an exception when attempting to delete a Transaction, THEN THE App SHALL display an inline error message on that Transaction entry and retain both the Local_Storage entry and the Transaction_List entry unchanged.

---

### Requirement 5: Visualize Spending by Category

**User Story:** As a user, I want to see a chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL render a pie or donut Chart displaying the total amount spent per Category for all expense Transactions currently in Local_Storage, where each slice is proportional to that Category's share of total expenses.
2. WHEN a Transaction is added or deleted, THE App SHALL update the Chart and its legend immediately (within 300 ms) without requiring a page reload or any additional user interaction.
3. THE App SHALL assign a distinct color to each Category represented in the Chart, and that color SHALL remain the same for a given Category across re-renders within the same browser session.
4. THE App SHALL display a legend identifying each Category and its corresponding color in or adjacent to the Chart.
5. WHEN Local_Storage contains no expense Transactions, THE App SHALL display a visible placeholder text in the Chart area indicating that no expense data is available.

---

### Requirement 6: Persist Data with Local Storage

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my data when I close the tab.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL read all Transaction data from Local_Storage and render the Transaction_List, Balance, and Chart from that data before accepting user interaction.
2. WHEN a Transaction is saved successfully, THE App SHALL write it to Local_Storage before updating the Transaction_List and Balance displays.
3. WHEN a Transaction is deleted successfully, THE App SHALL remove its entry from Local_Storage before removing it from the Transaction_List display.
4. WHEN the user sets a Theme preference, THE App SHALL write the selected Theme value to Local_Storage under a dedicated key.
5. WHEN the App loads, THE App SHALL read the Theme preference from Local_Storage and apply it before rendering any UI elements.
6. WHEN the user saves a Custom_Category, THE App SHALL append it to the Custom_Category list in Local_Storage under a dedicated key.
7. WHEN the App loads, THE App SHALL read the Custom_Category list from Local_Storage and add each entry to all category selectors before accepting user interaction.
8. IF Local_Storage contains malformed or unparseable data under any App key, THEN THE App SHALL discard that key's data, treat it as empty, and continue loading without throwing an uncaught exception.
9. IF Local_Storage is unavailable or throws an exception during any read or write operation, THEN THE App SHALL display a non-blocking warning banner informing the user that data will not be persisted for the current session, and SHALL continue operating using in-memory state only.

---

### Requirement 7: Add Custom Categories

**User Story:** As a user, I want to create my own spending categories, so that I can organize my transactions in a way that matches my lifestyle.

#### Acceptance Criteria

1. THE App SHALL provide a set of built-in default categories (at minimum: Food, Transport, Entertainment, Health, Shopping, Bills, Other).
2. THE App SHALL provide a control that allows the user to enter and save a new Custom_Category name between 1 and 50 characters in length, up to a maximum of 50 custom categories.
3. WHEN the user saves a Custom_Category, THE App SHALL add it to every category selector and filter control in the App so that it appears as an option without requiring a page reload.
4. WHEN the user saves a Custom_Category, THE App SHALL persist it to Local_Storage so it remains available after a page reload.
5. IF the user attempts to save a Custom_Category with an empty name, a name exceeding 50 characters, or a name identical (case-insensitive) to an existing built-in or custom category, THEN THE App SHALL display a validation error adjacent to the input and prevent the entry from being saved.
6. THE App SHALL display all Custom_Category entries alongside built-in categories in any category selector or filter control, with custom categories visually distinguishable or grouped separately from built-in categories.

---

### Requirement 8: Monthly Summary View

**User Story:** As a user, I want to see a summary of my income and expenses for a specific month, so that I can understand my financial patterns over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary view that the user can navigate to from the main view via a clearly labeled navigation control.
2. THE App SHALL provide month and year selectors that allow the user to choose any calendar month from the earliest Transaction date to the current month.
3. WHEN a month and year are selected, THE App SHALL calculate and display within 300 ms: total income, total expenses, net balance (income minus expenses), and a per-Category breakdown of expenses for that month.
4. THE App SHALL render the per-Category expense breakdown as a table or Chart within the Monthly_Summary view, showing the Category name, total amount, and percentage of monthly expenses for each Category.
5. WHEN the selected month contains no Transactions, THE App SHALL display an empty-state message in the Monthly_Summary view indicating that no transactions were recorded for that month.
6. WHEN the user navigates back from the Monthly_Summary view, THE App SHALL return the user to the main transaction view with all Transaction_List, Balance, and Chart data intact and unchanged.

---

### Requirement 9: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light mode, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control for switching between "light" and "dark" Theme, positioned persistently in the header or settings area and labeled with an aria-label of "Toggle dark/light mode".
2. WHEN the user activates the Theme toggle, THE App SHALL apply the selected Theme to all visible UI elements within 300 ms without a page reload.
3. IF no Theme preference is stored in Local_Storage on first load, THEN THE App SHALL apply the Theme that matches the user's operating-system preference as detected via `prefers-color-scheme`.
4. WHEN the user sets a Theme preference, THE App SHALL save it to Local_Storage so the same Theme is applied on the next page load.
5. WHILE the "dark" Theme is active, THE App SHALL ensure normal body text maintains a contrast ratio of at least 4.5:1 and large text and UI component boundaries maintain a contrast ratio of at least 3:1 against their backgrounds, meeting WCAG AA requirements.
6. WHILE the "light" Theme is active, THE App SHALL ensure normal body text maintains a contrast ratio of at least 4.5:1 and large text and UI component boundaries maintain a contrast ratio of at least 3:1 against their backgrounds, meeting WCAG AA requirements.
7. IF Local_Storage is unavailable when saving or reading the Theme preference, THEN THE App SHALL apply the OS-detected Theme preference for the current session without displaying an additional error.

---

### Requirement 10: Responsive Mobile-Friendly Layout

**User Story:** As a user, I want the app to work well on my phone, so that I can track expenses on the go.

#### Acceptance Criteria

1. THE App SHALL render all core UI elements (Balance summary, transaction form, Transaction_List, and Chart) in a single-column layout on viewport widths of 375 px and below.
2. THE App SHALL use relative units (rem, %, vw) for font sizes and layout dimensions, with a minimum computed font size of no less than 12 px for body text, to allow proportional scaling across different screen sizes.
3. THE App SHALL ensure all interactive controls (buttons, inputs, selectors) have a minimum touch target size of 44 × 44 CSS pixels.
4. WHEN the viewport width is 768 px or greater, THE App SHALL display the transaction form and the Transaction_List in a two-column side-by-side layout to make use of the additional space.
5. THE App SHALL function correctly in Chrome, Firefox, Edge, and Safari on both desktop and mobile such that all core UI elements are visible and all interactive controls remain operable without browser-specific polyfills.
