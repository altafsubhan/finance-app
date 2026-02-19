-- Track whether an account snapshot is manually recorded or derived from income.

ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_snapshots_snapshot_source_check'
  ) THEN
    ALTER TABLE public.account_snapshots
      ADD CONSTRAINT account_snapshots_snapshot_source_check
      CHECK (snapshot_source IN ('manual', 'income'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_snapshots_account_source_date
  ON public.account_snapshots(account_id, snapshot_source, snapshot_date DESC);
