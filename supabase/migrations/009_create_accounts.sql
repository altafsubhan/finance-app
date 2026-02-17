-- Account balance tracking feature
-- Private by default; optionally shared per-account via is_shared flag.

-- ============================================================
-- 1. accounts – each financial account a user wants to track
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'checking', 'savings', 'credit_card',
    'investment', 'retirement', 'loan',
    'crypto', 'cash', 'other'
  )),
  institution TEXT,                        -- e.g. "Chase", "Fidelity"
  is_shared BOOLEAN NOT NULL DEFAULT false, -- opt-in sharing with partners
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- ============================================================
-- 2. account_snapshots – periodic balance recordings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(14, 2) NOT NULL,
  snapshot_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_account_id ON public.account_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON public.account_snapshots(snapshot_date DESC);

-- ============================================================
-- 3. balance_allocations – segmenting money within an account
-- ============================================================
CREATE TABLE IF NOT EXISTS public.balance_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  allocation_type TEXT NOT NULL DEFAULT 'fixed' CHECK (allocation_type IN ('fixed', 'percentage')),
  color TEXT,                               -- optional hex color for UI
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(account_id, label)
);

CREATE INDEX IF NOT EXISTS idx_allocations_account_id ON public.balance_allocations(account_id);

-- ============================================================
-- Auto-update updated_at triggers
-- ============================================================
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at
  BEFORE UPDATE ON public.balance_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS – Private by default, opt-in sharing
-- ============================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_allocations ENABLE ROW LEVEL SECURITY;

-- Helper: determines if a given account is visible to the current user.
-- Visible if: user owns it OR (it is shared AND the owner granted access).
CREATE OR REPLACE FUNCTION public.can_view_account(acct_user_id UUID, acct_is_shared BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() = acct_user_id THEN
    RETURN true;
  END IF;
  IF acct_is_shared AND EXISTS (
    SELECT 1 FROM public.shared_access
    WHERE owner_id = acct_user_id AND shared_with_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_view_account(UUID, BOOLEAN) TO authenticated;

-- ---- accounts policies ----
CREATE POLICY "Users can view own or shared accounts" ON public.accounts
  FOR SELECT USING (can_view_account(user_id, is_shared));

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- ---- account_snapshots policies ----
CREATE POLICY "Users can view own or shared snapshots" ON public.account_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND can_view_account(a.user_id, a.is_shared)
    )
  );

CREATE POLICY "Users can insert own snapshots" ON public.account_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots" ON public.account_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots" ON public.account_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- ---- balance_allocations policies ----
CREATE POLICY "Users can view own or shared allocations" ON public.balance_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND can_view_account(a.user_id, a.is_shared)
    )
  );

CREATE POLICY "Users can insert own allocations" ON public.balance_allocations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allocations" ON public.balance_allocations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own allocations" ON public.balance_allocations
  FOR DELETE USING (auth.uid() = user_id);
