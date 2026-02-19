-- Optional investment portfolio composition with live pricing support.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS investment_portfolio_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS investment_live_pricing_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.account_portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL CHECK (symbol ~ '^[A-Za-z0-9.-]{1,15}$'),
  shares DECIMAL(18, 6) NOT NULL CHECK (shares > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(account_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_account_portfolio_holdings_account_id
  ON public.account_portfolio_holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_account_portfolio_holdings_user_id
  ON public.account_portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_account_portfolio_holdings_symbol
  ON public.account_portfolio_holdings(symbol);

DROP TRIGGER IF EXISTS update_account_portfolio_holdings_updated_at
  ON public.account_portfolio_holdings;
CREATE TRIGGER update_account_portfolio_holdings_updated_at
  BEFORE UPDATE ON public.account_portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.account_portfolio_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or shared portfolio holdings"
  ON public.account_portfolio_holdings;
DROP POLICY IF EXISTS "Users can insert own portfolio holdings"
  ON public.account_portfolio_holdings;
DROP POLICY IF EXISTS "Users can update own portfolio holdings"
  ON public.account_portfolio_holdings;
DROP POLICY IF EXISTS "Users can delete own portfolio holdings"
  ON public.account_portfolio_holdings;

CREATE POLICY "Users can view own or shared portfolio holdings"
  ON public.account_portfolio_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = account_id
        AND can_view_account(a.user_id, a.is_shared)
    )
  );

CREATE POLICY "Users can insert own portfolio holdings"
  ON public.account_portfolio_holdings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = account_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own portfolio holdings"
  ON public.account_portfolio_holdings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio holdings"
  ON public.account_portfolio_holdings
  FOR DELETE USING (auth.uid() = user_id);
