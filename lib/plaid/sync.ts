import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlaidClient } from './client';
import {
  ensurePaymentMethodsForPlaidAccounts,
  formatPlaidAccountLabel,
} from './accounts';
import { suggestCategoryIdForDescription } from '@/lib/rules/categoryRules';
import type { Category, CategoryRule, CategoryRuleBlocklist } from '@/types/database';

interface PlaidItemRow {
  id: string;
  user_id: string;
  access_token: string;
  cursor: string | null;
}

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
 * dedupes on plaid_transaction_id and advances the saved cursor. Never writes to
 * the real `transactions` table - approval happens later in the inbox UI.
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
  const institutionName = itemMeta?.institution_name;

  // Link Plaid accounts to payment_methods (match "Chase Sapphire" etc. or create).
  await ensurePaymentMethodsForPlaidAccounts(
    supabase,
    item.id,
    item.user_id,
    institutionName
  );

  // Load categorization context once (household-scoped under RLS; full set under
  // the admin client used by cron - fine for a single-household app).
  const [{ data: categories }, { data: rulesData }] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('category_rules').select('*'),
  ]);
  const { data: blocklistData } = await supabase
    .from('category_rule_blocklist')
    .select('*');

  const cats = (categories || []) as Category[];
  const rules = (rulesData || []) as CategoryRule[];
  const blocklist = (blocklistData || []) as CategoryRuleBlocklist[];
  const catById = new Map(cats.map((c) => [c.id, c]));

  // Map Plaid account ids -> payment method name + shared flag for inbox rows.
  const { data: plaidAccounts } = await supabase
    .from('plaid_accounts')
    .select('account_id, payment_method_id, name, official_name, mask, type, subtype')
    .eq('plaid_item_id', item.id);

  const pmIds = (plaidAccounts || [])
    .map((a: any) => a.payment_method_id)
    .filter(Boolean);
  let pmNameById = new Map<string, { name: string; is_shared: boolean }>();
  if (pmIds.length > 0) {
    const { data: pms } = await supabase
      .from('payment_methods')
      .select('id, name, is_shared')
      .in('id', pmIds);
    pmNameById = new Map((pms || []).map((p: any) => [p.id, { name: p.name, is_shared: p.is_shared }]));
  }
  const accountToMethod = new Map<string, { name: string; is_shared: boolean }>();
  for (const a of plaidAccounts || []) {
    const pm = a.payment_method_id ? pmNameById.get(a.payment_method_id) : null;
    accountToMethod.set(a.account_id, {
      name: pm?.name || formatPlaidAccountLabel(a, institutionName),
      is_shared: pm?.is_shared ?? true,
    });
  }

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

    // Skip Plaid pending transactions — only stage posted transactions in the inbox.
    const posted = [...data.added, ...data.modified].filter((t: any) => !t.pending);

    const upserts = posted.map((t: any) => {
      const method = accountToMethod.get(t.account_id);
      const suggestion = suggestCategoryIdForDescription({
        description: t.merchant_name || t.name || '',
        rules,
        blocklist,
        categories: cats,
      });
      const suggestedCat = suggestion ? catById.get(suggestion.category_id) : null;
      // Default to shared scope; only inherit from a matched category suggestion.
      const isShared = suggestedCat ? suggestedCat.is_shared : true;

      return {
        user_id: item.user_id,
        source: 'plaid',
        status: 'pending',
        plaid_item_id: item.id,
        plaid_account_id: t.account_id,
        plaid_transaction_id: t.transaction_id,
        date: t.date,
        amount: t.amount,
        description: t.name || t.merchant_name || '',
        merchant_name: t.merchant_name || null,
        suggested_category_id: suggestedCat?.id || null,
        payment_method: method?.name || null,
        is_shared: isShared,
        is_pending: false,
        raw: t,
      };
    });

    if (upserts.length > 0) {
      // Only touch rows that are still pending; never resurrect dismissed/approved.
      const { error } = await supabase
        .from('imported_transactions')
        .upsert(upserts, { onConflict: 'plaid_transaction_id', ignoreDuplicates: false });
      if (error) throw error;
    }

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

  return { itemId: item.id, added, modified, removed };
}
