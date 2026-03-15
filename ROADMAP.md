# Finance App — Dashboard & Feature Roadmap

This document captures recommendations for improving the dashboard, UI/UX, and overall feature set of the finance app. Items are organized by priority and can be tackled incrementally.

---

## Phase 1: Dashboard Foundation (Completed)

- [x] Shared / Personal scope toggle on the dashboard
- [x] Key metric cards: Total Spent, Avg Monthly, Budget Health %, Outstanding
- [x] Outstanding Payments widget with long-press transaction preview
- [x] Mark-as-paid flow accessible from the dashboard
- [x] Budget vs Spending panels (monthly, quarterly, annual) integrated into dashboard
- [x] Monthly & Quarterly overview grids (collapsed by default)
- [x] Phase out Summaries section from the expenses page
- [x] Dashboard API updated to support personal expense categories

---

## Phase 2: Financial Health View

### Net Worth Card
- Aggregate latest `account_snapshots` across all accounts
- Calculate: `SUM(asset balances) - SUM(liability balances)` (credit cards, loans)
- Display: current net worth, month-over-month change (absolute + %), sparkline trend (6–12 months)
- Data is already available — accounts page computes per-account; just needs aggregation

### Cash Flow Chart (Income vs Expenses)
- Bar or area chart showing income vs expenses over the last 6–12 months
- Use Recharts (`BarChart` or `AreaChart`) — already in `package.json` but unused
- Cash Flow = Total Income − Total Expenses per month
- Consider a toggle to exclude non-spendable income (401k, HSA contributions)
- Display net cash flow as a positive/negative indicator

### Account Balances Mini-List
- Compact list of each account with its latest balance and a trend indicator (up/down arrow)
- Group by account type: checking, savings, credit cards, investments
- Link each to the relevant accounts page

### Savings Rate Metric
- `Savings Rate = (Income - Expenses) / Income × 100%`
- Display as a percentage with a recommended target line (e.g., 20%)
- Could be a standalone card or integrated into the cash flow section

### Recent Transactions Widget
- Show the last 5–10 transactions with date, description, amount, and category
- Include a "View All" link to the expenses page
- Highlight any uncategorized transactions as action items

---

## Phase 3: Couples-Specific Features

### Shared vs Personal Spending Breakdown
- Visual breakdown: "This month you spent $X shared, $Y personal"
- Stacked bar or two-tone progress bar
- Every transaction already has `is_shared` — straightforward to compute

### Who-Paid-More Balance Tracker
- Since transactions have `payment_method` and `paid_by`, compute each person's contribution
- For shared 50/50 expenses, show the imbalance: "Subi has paid $X more in shared expenses this month"
- Requires associating payment methods with users (could parse name prefix like "Mano Chase Freedom" or add a `user_id` field to `payment_methods`)

### Per-Person Outstanding Amounts
- Extend outstanding summary to show not just by payment method but by person
- Since credit card bills are per-person, this tells each partner what they need to pay off

### Per-Person Budget Contribution
- Show per-person contribution to shared budget categories
- Example: "Grocery budget: $800. Subi spent $450, Mano spent $250. $100 remaining."

### Settle-Up Flow
- If there's an imbalance in shared expense payments, offer a "settle up" action
- Record a transfer between accounts to zero out the balance
- Already have transfer recording via `RecordTransferModal`

---

## Phase 4: Intelligence & Insights

### Month-over-Month Spending Trend
- Simple directional indicator on KPI cards: "12% more than last month" or "8% less"
- Lightweight but psychologically impactful

### Year-over-Year Comparisons
- Add "vs last year" comparison to KPI cards
- Multi-year data already exists; just needs a comparison computation

### Projected End-of-Month Spending
- Extrapolate: `(spent_so_far / days_elapsed) × days_in_month`
- Display as a projected total with a warning if it exceeds budget

### Spending Alerts
- Threshold-based: flag when a category exceeds 80% or 100% of budget
- Could be an in-app banner on the dashboard rather than push notifications
- Consider a small "alerts" section at the top of the dashboard

### Recurring Expense Detection
- Analyze transaction descriptions + amounts for patterns (same description, similar amount, regular interval)
- Surface detected subscriptions and recurring charges
- Useful for identifying forgotten subscriptions

---

## Phase 5: Goals & Planning

### Savings Goals
- New table: `savings_goals` (name, target_amount, current_amount, deadline)
- Display progress bars on the dashboard
- Could tie into specific accounts or money segments (allocations)

### Bill Reminders / Calendar
- New table: `bills` or `recurring_expenses` with due dates
- Calendar view or upcoming bills list
- Notification system (in-app or email)

### Cash Flow Forecasting
- Combine recurring expenses, known income dates, and account balances
- Project future account balances over next 30/60/90 days
- Useful for timing large purchases

---

## Phase 6: Visual & UX Polish

### Recharts Integration
- Replace CSS-only visualizations with Recharts components
- Recommended chart types:
  - Cash flow: `BarChart` (grouped bars, income vs expenses)
  - Net worth over time: `AreaChart`
  - Category breakdown: `PieChart` (donut variant)
  - Sparklines in cards: `LineChart` with no axes
  - Budget progress: horizontal progress bars (keep current approach)

### Color Scheme Refinement
- Positive / income / under-budget: `emerald-500` (#10B981)
- Negative / expense / over-budget: `rose-500` (#F43F5E)
- Neutral / informational: `blue-600` (#2563EB)
- Warning / caution: `amber-500` (#F59E0B)
- Shared accent: `blue-100` / `blue-600`
- Personal accent: `purple-100` / `purple-600`

### Information Hierarchy
- Hero cards: large text, minimal labels, bold numbers — readable at a glance
- Charts: medium density, clear axis labels, tooltips on hover, no gridlines
- Detail sections: higher density is fine (tables, lists)
- Use `gap-6` between major sections for breathing room

### Mobile Responsiveness
- Hero cards: 2-col on mobile, 4-col on desktop
- Charts: full-width, minimum height 200px on mobile
- Budget progress: stack vertically on mobile
- Account list: always single column

### Investment Portfolio Summary
- Surface total portfolio value + daily change on the dashboard
- Data already exists in `account_portfolio_holdings` with live pricing

---

## Technical Debt & Improvements

### Hardcoded Category Lists
- `BudgetVsSpendingPanel` and the dashboard API have hardcoded `FIXED_EXPENSES`, `VARIABLE_EXPENSES`, and `IGNORED_EXPENSES` sets
- Fragile as categories change — consider adding a `group` or `expense_type` field to the `categories` table

### Centralize Types
- Account-related types (`Account`, `Snapshot`, `Allocation`, `PortfolioHolding`) are defined locally in `app/accounts/page.tsx`
- Move to `types/database.ts` for reuse across dashboard and other pages

### Parallel Data Fetching
- Dashboard now uses `Promise.all` for parallel fetches (done)
- Apply same pattern to other pages that make sequential API calls

### Component Extraction
- As dashboard grows, extract each widget into its own component
- Examples: `NetWorthCard.tsx`, `CashFlowChart.tsx`, `SavingsRateCard.tsx`, `RecentTransactions.tsx`

### Navigation Simplification
- Consider making `/dashboard` the default authenticated route
- The home page (`app/page.tsx`) is currently a link hub that may become redundant
