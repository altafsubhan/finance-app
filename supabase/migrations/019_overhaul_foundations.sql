-- Migration 019: Foundations for the finance-app overhaul
--
-- This migration is intentionally ADDITIVE ONLY. It does not drop or delete
-- any rows or columns. It introduces:
--   1. Data-driven expense grouping + archiving on categories
--      (replaces the hardcoded fixed/variable/ignored sets in code).
--   2. Ownership + shared flag on payment_methods (which physical cards are
--      jointly used) to drive shared-card attribution.
--   3. Attribution / claim / privacy fields on transactions so a partner's
--      personal charge on a shared card can show as an "accounted for" line.

-- ============================================================
-- 1. categories: expense_group, archived_at, sort_order
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS expense_group TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Constrain expense_group to known values (NULL = untracked / not grouped).
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_expense_group_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_expense_group_check
  CHECK (expense_group IS NULL OR expense_group IN ('fixed', 'variable', 'ignored'));

CREATE INDEX IF NOT EXISTS idx_categories_expense_group
  ON public.categories(expense_group);
CREATE INDEX IF NOT EXISTS idx_categories_archived_at
  ON public.categories(archived_at);

-- Seed expense_group to preserve the CURRENT dashboard behavior, which keyed
-- off these normalized names (lowercased, whitespace removed).
-- Fixed expenses
UPDATE public.categories
SET expense_group = 'fixed'
WHERE expense_group IS NULL
  AND LOWER(REPLACE(name, ' ', '')) IN ('rent', 'car-insurance', 'phone+wifi');

-- Variable expenses
UPDATE public.categories
SET expense_group = 'variable'
WHERE expense_group IS NULL
  AND LOWER(REPLACE(name, ' ', '')) IN (
    'activities', 'car-charging', 'car-cleaning', 'car-gas', 'food-caafe',
    'food-eatout', 'food-office', 'grocery', 'houseitems', 'miscellaneous',
    'subscriptions', 'utilities+electricity'
  );

-- Ignored (excluded from budget vs spending rollups)
UPDATE public.categories
SET expense_group = 'ignored'
WHERE expense_group IS NULL
  AND LOWER(REPLACE(name, ' ', '')) IN ('subipersonal', 'manopersonal', 'healthexpenses');

-- ============================================================
-- 2. payment_methods: ownership + shared flag
-- ============================================================
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payment_methods_owner_id
  ON public.payment_methods(owner_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_shared
  ON public.payment_methods(is_shared);

-- ============================================================
-- 3. transactions: attribution / claim / privacy
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS attributed_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS details_private BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_claim_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_claim_status_check
  CHECK (claim_status IN ('unclaimed', 'claimed'));

CREATE INDEX IF NOT EXISTS idx_transactions_attributed_to
  ON public.transactions(attributed_to);
CREATE INDEX IF NOT EXISTS idx_transactions_claim_status
  ON public.transactions(claim_status);

-- Backfill: existing PERSONAL transactions are, by definition, already owned and
-- accounted for by the person who entered them. Mark them claimed + attributed
-- so they immediately show as "accounted for" without changing any amounts.
UPDATE public.transactions
SET attributed_to = user_id,
    claim_status = 'claimed'
WHERE is_shared = false
  AND attributed_to IS NULL;
