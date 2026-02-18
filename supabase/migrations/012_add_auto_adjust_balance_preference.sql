-- User preference for applying income-based balance adjustments on account cards.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_adjust_balances_from_income BOOLEAN NOT NULL DEFAULT false;
