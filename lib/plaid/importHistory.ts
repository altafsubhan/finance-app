import type { SupabaseClient } from '@supabase/supabase-js';
import { ensurePaymentMethodsForPlaidAccounts } from './accounts';
import { getPlaidClient } from './client';
import {
  loadStagingContext,
  normalizeUncategorizedSharedScope,
  stagePlaidTransactions,
  type PlaidItemRow,
} from './staging';

export async function importPlaidTransactionsSince(
  supabase: SupabaseClient,
  item: PlaidItemRow,
  startDate: string,
  endDate?: string
): Promise<{ staged: number }> {
  const { data: itemMeta } = await supabase
    .from('plaid_items')
    .select('institution_name')
    .eq('id', item.id)
    .single();

  await ensurePaymentMethodsForPlaidAccounts(
    supabase,
    item.id,
    item.user_id,
    itemMeta?.institution_name
  );

  const context = await loadStagingContext(supabase, item);
  const { data: accounts } = await supabase
    .from('plaid_accounts')
    .select('account_id')
    .eq('plaid_item_id', item.id);
  const accountIds = (accounts || []).map((a) => a.account_id);
  if (accountIds.length === 0) return { staged: 0 };

  const plaid = getPlaidClient();
  const end = endDate || new Date().toISOString().slice(0, 10);
  let offset = 0;
  let staged = 0;

  while (true) {
    const resp = await plaid.transactionsGet({
      access_token: item.access_token,
      start_date: startDate,
      end_date: end,
      options: {
        count: 500,
        offset,
        account_ids: accountIds,
      },
    });

    staged += await stagePlaidTransactions(supabase, item, resp.data.transactions, context);

    offset += resp.data.transactions.length;
    if (offset >= resp.data.total_transactions || resp.data.transactions.length === 0) break;
  }

  await normalizeUncategorizedSharedScope(supabase, item.user_id);
  return { staged };
}
