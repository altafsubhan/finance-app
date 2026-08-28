-- Add per-period expense_group override to budgets.
-- Allows marking a specific budget period as fixed/variable/ignored
-- independently of the category-level default. NULL means "inherit from category".

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS expense_group TEXT
    CHECK (expense_group IN ('fixed', 'variable', 'ignored'));
