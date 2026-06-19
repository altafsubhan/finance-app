-- Migration 022: Private Plaid linkage + inbox per user
--
-- Each partner links their own banks and reviews only their own staged
-- transactions. Cron still syncs all items via the service-role client.

-- plaid_items
DROP POLICY IF EXISTS "Household can view plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Household can update plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Household can delete plaid items" ON public.plaid_items;

CREATE POLICY "Users can view own plaid items" ON public.plaid_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid items" ON public.plaid_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid items" ON public.plaid_items
  FOR DELETE USING (auth.uid() = user_id);

-- plaid_accounts
DROP POLICY IF EXISTS "Household can view plaid accounts" ON public.plaid_accounts;
DROP POLICY IF EXISTS "Household can update plaid accounts" ON public.plaid_accounts;
DROP POLICY IF EXISTS "Household can delete plaid accounts" ON public.plaid_accounts;

CREATE POLICY "Users can view own plaid accounts" ON public.plaid_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid accounts" ON public.plaid_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid accounts" ON public.plaid_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- imported_transactions (inbox)
DROP POLICY IF EXISTS "Household can view inbox" ON public.imported_transactions;
DROP POLICY IF EXISTS "Household can update inbox" ON public.imported_transactions;
DROP POLICY IF EXISTS "Household can delete inbox" ON public.imported_transactions;

CREATE POLICY "Users can view own inbox" ON public.imported_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own inbox" ON public.imported_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inbox" ON public.imported_transactions
  FOR DELETE USING (auth.uid() = user_id);
