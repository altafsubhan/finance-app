-- Add entry typing for income tracking so contributions can be separated
-- from regular monthly income summaries.

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'income';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'income_entries_entry_type_check'
  ) THEN
    ALTER TABLE public.income_entries
      ADD CONSTRAINT income_entries_entry_type_check
      CHECK (entry_type IN ('income', '401k', 'hsa'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_income_entries_entry_type
  ON public.income_entries(entry_type);
