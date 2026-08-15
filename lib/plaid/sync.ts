import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlaidClient } from './client';
import { ensurePaymentMethodsForPlaidAccounts } from './accounts';
import {
  loadStagingContext,
  normalizeUncategorizedSharedScope,
  stagePlaidTransactions,
  type PlaidItemRow,
} from './staging';

interface SyncResult {
  itemId: string;
  added: number;
  modified: number;
  removed: number;
}

/**
 * Pull new/updated transactions for a single Plaid item using /transactions/sync
 * and stage them in `imported_transactions` (the review inbox). Only posted
 * (non-pending) Plaid transactions are staged. Idempotent: dedupes on
 * plaid_transaction_id and advances the saved cursor. Never writes to the real
 * `transactions` table - approval happens later in the inbox UI.
 */
export async function syncPlaidItem(
  supabase: SupabaseClient,
  item: PlaidItemRow
): Promise<SyncResult> {
  const plaid = getPlaidClient();

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

  let cursor = item.cursor || undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const resp = await plaid.transactionsSync({
      access_token: item.access_token,
      cursor,
      count: 250,
    });
    const data = resp.data;

    const posted = [...data.added, ...data.modified].filter((t: any) => !t.pending);
    await stagePlaidTransactions(supabase, item, posted, context);

    added += posted.filter((t: any) => data.added.some((a: any) => a.transaction_id === t.transaction_id)).length;
    modified += posted.filter((t: any) => data.modified.some((m: any) => m.transaction_id === t.transaction_id)).length;
    removed += data.removed.length;

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await supabase
    .from('plaid_items')
    .update({ cursor, last_synced_at: new Date().toISOString(), status: 'active' })
    .eq('id', item.id);

  await normalizeUncategorizedSharedScope(supabase, item.user_id);

  return { itemId: item.id, added, modified, removed };
}
