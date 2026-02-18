-- Income tracking feature
-- Private by default, with visibility aligned to account-sharing rules.

CREATE TABLE IF NOT EXISTS public.income_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
  received_date DATE NOT NULL,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_income_entries_user_id ON public.income_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_account_id ON public.income_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_received_date ON public.income_entries(received_date DESC);

DROP TRIGGER IF EXISTS update_income_entries_updated_at ON public.income_entries;
CREATE TRIGGER update_income_entries_updated_at
  BEFORE UPDATE ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or shared income entries" ON public.income_entries;
DROP POLICY IF EXISTS "Users can insert own income entries" ON public.income_entries;
DROP POLICY IF EXISTS "Users can update own income entries" ON public.income_entries;
DROP POLICY IF EXISTS "Users can delete own income entries" ON public.income_entries;

CREATE POLICY "Users can view own or shared income entries" ON public.income_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND can_view_account(a.user_id, a.is_shared)
    )
  );

CREATE POLICY "Users can insert own income entries" ON public.income_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income entries" ON public.income_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income entries" ON public.income_entries
  FOR DELETE USING (auth.uid() = user_id);
