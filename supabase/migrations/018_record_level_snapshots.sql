-- Migration 018: Record-level account balance snapshots
--
-- Changes:
--   1. Drop unique constraint on (account_id, snapshot_date) to allow multiple
--      balance entries per day for record-level granularity.
--   2. Add reference_type and reference_id columns so each snapshot row can be
--      traced back to the record that caused it.
--   3. Update snapshot_source constraint to accept new source types.
--   4. Add skip_balance_update to transactions and income_entries so the user
--      can opt out of balance adjustments on a per-record basis.

-- ============================================================
-- 1. Drop the per-day unique constraint
-- ============================================================
ALTER TABLE public.account_snapshots
  DROP CONSTRAINT IF EXISTS account_snapshots_account_id_snapshot_date_key;

-- ============================================================
-- 2. Add reference columns for record-level tracking
-- ============================================================
ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

-- ============================================================
-- 3. Widen the snapshot_source check constraint
-- ============================================================
ALTER TABLE public.account_snapshots
  DROP CONSTRAINT IF EXISTS account_snapshots_snapshot_source_check;

ALTER TABLE public.account_snapshots
  ADD CONSTRAINT account_snapshots_snapshot_source_check
  CHECK (snapshot_source IN ('manual', 'income', 'expense_payment', 'transfer'));

-- ============================================================
-- 4. Better index for "latest balance" queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_snapshots_latest_balance
  ON public.account_snapshots(account_id, snapshot_date DESC, created_at DESC);

-- ============================================================
-- 5. skip_balance_update on transactions
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS skip_balance_update BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 6. skip_balance_update on income_entries
-- ============================================================
ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS skip_balance_update BOOLEAN NOT NULL DEFAULT false;
