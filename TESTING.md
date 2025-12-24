# Testing Guide

## Manual Testing Checklist

### 1. Setup & Authentication
- [ ] Create Supabase project and run migrations
- [ ] Create user accounts (you + wife)
- [ ] Test login functionality
- [ ] Test logout functionality
- [ ] Verify protected routes redirect to login

### 2. Categories
- [ ] Navigate to Categories page
- [ ] Click "Initialize Default Categories"
- [ ] Verify all categories are created (monthly, quarterly, yearly)
- [ ] Verify categories are grouped correctly

### 3. Transactions
- [ ] Navigate to Transactions page
- [ ] Add a new transaction manually:
  - [ ] Fill in all fields (date, amount, description, category, payment method, paid_by)
  - [ ] Verify transaction appears in list
  - [ ] Verify color coding based on paid_by (blue=joint, green=mano, orange=sobi)
- [ ] Edit an existing transaction
- [ ] Delete a transaction
- [ ] Filter transactions by:
  - [ ] Year
  - [ ] Category
  - [ ] Payment method
- [ ] Test CSV import:
  - [ ] Upload a CSV file
  - [ ] Preview the data
  - [ ] Import transactions
  - [ ] Verify imported transactions appear

### 4. Budgets
- [ ] Navigate to Budgets page
- [ ] Add a budget for a category:
  - [ ] Monthly budget
  - [ ] Quarterly budget
  - [ ] Yearly budget
- [ ] Edit an existing budget
- [ ] Delete a budget
- [ ] Filter budgets by year

### 5. Dashboard
- [ ] Navigate to Dashboard
- [ ] Verify totals are displayed correctly:
  - [ ] Total Budget
  - [ ] Total Spending
  - [ ] Difference (color-coded)
- [ ] Verify chart displays (top 10 categories)
- [ ] Test period filters:
  - [ ] Yearly view
  - [ ] Quarterly view (select Q1, Q2, Q3, Q4)
  - [ ] Monthly view (select different months)
- [ ] Verify summary tables:
  - [ ] Monthly categories section
  - [ ] Quarterly categories section
  - [ ] Yearly categories section
- [ ] Verify color coding (green=under budget, red=over budget)
- [ ] Verify averages are calculated correctly

### 6. Multi-Year Support
- [ ] Add transactions for different years
- [ ] Set budgets for different years
- [ ] Switch between years in dashboard
- [ ] Verify data is filtered correctly by year

### 7. Edge Cases
- [ ] Try to add transaction without required fields
- [ ] Try to add budget without amount
- [ ] Import CSV with missing columns
- [ ] Import CSV with invalid data
- [ ] Test with very large amounts
- [ ] Test with negative amounts (if applicable)

## Automated Testing (Future)

To add automated tests, consider:

1. **Unit Tests** (Jest + React Testing Library):
   - Component rendering
   - Form validation
   - Utility functions

2. **Integration Tests**:
   - API routes
   - Database operations
   - Authentication flow

3. **E2E Tests** (Playwright or Cypress):
   - Complete user workflows
   - Transaction creation flow
   - Budget setup flow
   - Dashboard viewing

## Running the App

1. **Development Mode**:
   ```bash
   npm run dev
   ```
   Then open [http://localhost:3000](http://localhost:3000)

2. **Build Check**:
   ```bash
   npm run build
   ```

3. **Type Check**:
   ```bash
   npx tsc --noEmit
   ```

## Known Issues

- None currently - all TypeScript errors have been fixed!

## Test Data

Sample CSV format for testing:
```csv
Date,Amount,Description,Category,Payment Method,Paid By
2025-01-15,45.99,Grocery Store,Grocery,Chase Sapphire,joint
2025-01-16,12.50,Coffee Shop,Food - Cafe,BOA Travel,mano
2025-01-17,89.00,Gas Station,Car - Gas,Chase Freedom,sobi
```

