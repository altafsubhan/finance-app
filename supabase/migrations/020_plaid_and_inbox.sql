-- Migration 020: Plaid linkage + the "review & approve" import inbox
--
-- Additive only. Introduces:
--   1. plaid_items     - one row per linked bank/card login (stores the Plaid
--                        access token + sync cursor).
--   2. plaid_accounts  - individual accounts/cards under an item, optionally
--                        mapped to an existing payment_method.
--   3. imported_transactions - the staging "inbox". Rows land here from Plaid
--                        (or screenshot/CSV) and are reviewed before they ever
--                        touch the real `transactions` table. Dismissing a row
--                        here NEVER deletes a real transaction.
--
-- SECURITY NOTE: access_token is sensitive. RLS restricts it to the household.
-- For stronger protection you can later move it into Supabase Vault / pgcrypto;
-- the API only ever reads it server-side with the service role.

-- ============================================================
-- 1. plaid_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON public.plaid_items(user_id);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household can view plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can insert own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Household can update plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Household can delete plaid items" ON public.plaid_items;

CREATE POLICY "Household can view plaid items" ON public.plaid_items
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Users can insert own plaid items" ON public.plaid_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Household can update plaid items" ON public.plaid_items
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Household can delete plaid items" ON public.plaid_items
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- ============================================================
-- 2. plaid_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id UUID NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL UNIQUE,
  name TEXT,
  official_name TEXT,
  mask TEXT,
  type TEXT,
  subtype TEXT,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON public.plaid_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON public.plaid_accounts(user_id);

ALTER TABLE public.plaid_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household can view plaid accounts" ON public.plaid_accounts;
DROP POLICY IF EXISTS "Users can insert own plaid accounts" ON public.plaid_accounts;
DROP POLICY IF EXISTS "Household can update plaid accounts" ON public.plaid_accounts;
DROP POLICY IF EXISTS "Household can delete plaid accounts" ON public.plaid_accounts;

CREATE POLICY "Household can view plaid accounts" ON public.plaid_accounts
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Users can insert own plaid accounts" ON public.plaid_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Household can update plaid accounts" ON public.plaid_accounts
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Household can delete plaid accounts" ON public.plaid_accounts
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- ============================================================
-- 3. imported_transactions (the inbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imported_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'plaid' CHECK (source IN ('plaid', 'screenshot', 'csv', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),

  plaid_item_id UUID REFERENCES public.plaid_items(id) ON DELETE SET NULL,
  plaid_account_id TEXT,
  plaid_transaction_id TEXT UNIQUE,
  dedupe_hash TEXT,

  date DATE,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  merchant_name TEXT,

  suggested_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  is_pending BOOLEAN NOT NULL DEFAULT false,

  approved_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_imported_tx_user ON public.imported_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_tx_status ON public.imported_transactions(status);
CREATE INDEX IF NOT EXISTS idx_imported_tx_dedupe ON public.imported_transactions(dedupe_hash);

ALTER TABLE public.imported_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household can view inbox" ON public.imported_transactions;
DROP POLICY IF EXISTS "Users can insert own inbox rows" ON public.imported_transactions;
DROP POLICY IF EXISTS "Household can update inbox" ON public.imported_transactions;
DROP POLICY IF EXISTS "Household can delete inbox" ON public.imported_transactions;

-- The inbox is a household workspace: either partner can review/approve.
CREATE POLICY "Household can view inbox" ON public.imported_transactions
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Users can insert own inbox rows" ON public.imported_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Household can update inbox" ON public.imported_transactions
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));
CREATE POLICY "Household can delete inbox" ON public.imported_transactions
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- ============================================================
-- 4. updated_at triggers (reuse update_updated_at_column from 001)
-- ============================================================
DROP TRIGGER IF EXISTS update_plaid_items_updated_at ON public.plaid_items;
CREATE TRIGGER update_plaid_items_updated_at BEFORE UPDATE ON public.plaid_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plaid_accounts_updated_at ON public.plaid_accounts;
CREATE TRIGGER update_plaid_accounts_updated_at BEFORE UPDATE ON public.plaid_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imported_transactions_updated_at ON public.imported_transactions;
CREATE TRIGGER update_imported_transactions_updated_at BEFORE UPDATE ON public.imported_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
