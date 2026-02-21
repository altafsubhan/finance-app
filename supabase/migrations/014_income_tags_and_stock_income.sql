-- Generalize income categorization via tags and support stock-based income entries.

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY['income']::TEXT[];

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS stock_symbol TEXT;

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS stock_shares DECIMAL(18, 6);

UPDATE public.income_entries
SET tags = CASE
  WHEN entry_type = '401k' THEN ARRAY['401k']::TEXT[]
  WHEN entry_type = 'hsa' THEN ARRAY['hsa']::TEXT[]
  ELSE ARRAY['income']::TEXT[]
END
WHERE tags IS NULL OR cardinality(tags) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'income_entries_stock_symbol_check'
  ) THEN
    ALTER TABLE public.income_entries
      ADD CONSTRAINT income_entries_stock_symbol_check
      CHECK (
        stock_symbol IS NULL
        OR stock_symbol ~ '^[A-Z0-9.-]{1,15}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'income_entries_stock_shares_check'
  ) THEN
    ALTER TABLE public.income_entries
      ADD CONSTRAINT income_entries_stock_shares_check
      CHECK (stock_shares IS NULL OR stock_shares > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'income_entries_stock_pair_check'
  ) THEN
    ALTER TABLE public.income_entries
      ADD CONSTRAINT income_entries_stock_pair_check
      CHECK ((stock_symbol IS NULL) = (stock_shares IS NULL));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_income_entries_tags
  ON public.income_entries USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_income_entries_stock_symbol
  ON public.income_entries(stock_symbol);
