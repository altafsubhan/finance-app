import type { SupabaseClient } from '@supabase/supabase-js';
import { formatPlaidAccountLabel } from './accounts';
import { suggestCategoryIdForDescription } from '@/lib/rules/categoryRules';
import type { Category, CategoryRule, CategoryRuleBlocklist } from '@/types/database';

export interface PlaidItemRow {
  id: string;
  user_id: string;
  access_token: string;
  cursor?: string | null;
}

export interface StagingContext {
  institutionName?: string | null;
  categories: Category[];
  rules: CategoryRule[];
  blocklist: CategoryRuleBlocklist[];
  accountToMethod: Map<string, { name: string }>;
}

export async function loadStagingContext(
  supabase: SupabaseClient,
  item: PlaidItemRow
): Promise<StagingContext> {
  const { data: itemMeta } = await supabase
    .from('plaid_items')
    .select('institution_name')
    .eq('id', item.id)
    .single();
  const institutionName = itemMeta?.institution_name;

  const [{ data: categories }, { data: rulesData }, { data: blocklistData }, { data: plaidAccounts }] =
    await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('category_rules').select('*'),
      supabase.from('category_rule_blocklist').select('*'),
      supabase
        .from('plaid_accounts')
        .select('account_id, payment_method_id, name, official_name, mask, type, subtype')
        .eq('plaid_item_id', item.id),
    ]);

  const pmIds = (plaidAccounts || [])
    .map((a: any) => a.payment_method_id)
    .filter(Boolean);
  let pmNameById = new Map<string, string>();
  if (pmIds.length > 0) {
    const { data: pms } = await supabase.from('payment_methods').select('id, name').in('id', pmIds);
    pmNameById = new Map((pms || []).map((p: any) => [p.id, p.name]));
  }

  const accountToMethod = new Map<string, { name: string }>();
  for (const a of plaidAccounts || []) {
    const pmName = a.payment_method_id ? pmNameById.get(a.payment_method_id) : null;
    accountToMethod.set(a.account_id, {
      name: pmName || formatPlaidAccountLabel(a, institutionName),
    });
  }

  return {
    institutionName,
    categories: (categories || []) as Category[],
    rules: (rulesData || []) as CategoryRule[],
    blocklist: (blocklistData || []) as CategoryRuleBlocklist[],
    accountToMethod,
  };
}

/**
 * Returns true for credit-card payment and loan-payment transactions that
 * Plaid includes in the feed but that should not appear in the review inbox
 * (they represent money moved *to* a card, not a real purchase or expense).
 *
 * Detection uses two Plaid categorisation systems:
 *  - personal_finance_category (newer): primary === "LOAN_PAYMENTS"
 *  - legacy category array: contains both "Transfer" and "Credit Card"
 */
export function isPaymentTransaction(t: any): boolean {
  const pfc = t.personal_finance_category?.primary;
  if (pfc === 'LOAN_PAYMENTS') return true;
  const cats: string[] = t.category || [];
  return cats.includes('Transfer') && cats.includes('Credit Card');
}

function buildInboxRow(
  t: any,
  item: PlaidItemRow,
  context: StagingContext,
  status: 'pending' | 'dismissed' | 'approved'
) {
  const catById = new Map(context.categories.map((c) => [c.id, c]));
  const method = context.accountToMethod.get(t.account_id);
  const suggestion = suggestCategoryIdForDescription({
    description: t.merchant_name || t.name || '',
    rules: context.rules,
    blocklist: context.blocklist,
    categories: context.categories,
  });
  const suggestedCat = suggestion ? catById.get(suggestion.category_id) : null;
  const isShared = suggestedCat ? suggestedCat.is_shared : true;

  return {
    user_id: item.user_id,
    source: 'plaid',
    status,
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
}

/** Stage posted Plaid transactions in the inbox. Restores dismissed rows; skips approved. */
export async function stagePlaidTransactions(
  supabase: SupabaseClient,
  item: PlaidItemRow,
  transactions: any[],
  context: StagingContext
): Promise<number> {
  const posted = transactions.filter((t) => !t.pending && !isPaymentTransaction(t));
  if (posted.length === 0) return 0;

  const plaidIds = posted.map((t) => t.transaction_id);
  const { data: existing } = await supabase
    .from('imported_transactions')
    .select('plaid_transaction_id, status')
    .in('plaid_transaction_id', plaidIds);

  const statusByPlaidId = new Map(
    (existing || []).map((row) => [row.plaid_transaction_id, row.status as string])
  );

  const upserts = posted
    .filter((t) => statusByPlaidId.get(t.transaction_id) !== 'approved')
    .map((t) => buildInboxRow(t, item, context, 'pending'));

  if (upserts.length === 0) return 0;

  const { error } = await supabase
    .from('imported_transactions')
    .upsert(upserts, { onConflict: 'plaid_transaction_id', ignoreDuplicates: false });
  if (error) throw error;

  return upserts.length;
}

export async function normalizeUncategorizedSharedScope(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from('imported_transactions')
    .update({ is_shared: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('suggested_category_id', null)
    .eq('is_shared', false);
}
