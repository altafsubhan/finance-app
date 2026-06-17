import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlaidAccountInfo {
  id?: string;
  account_id: string;
  name?: string | null;
  official_name?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  payment_method_id?: string | null;
}

export interface PaymentMethodInfo {
  id: string;
  name: string;
  is_shared: boolean;
}

/** Human-readable card/account label for inbox + transactions. */
export function formatPlaidAccountLabel(
  account: Pick<PlaidAccountInfo, 'name' | 'official_name' | 'mask' | 'subtype' | 'type'>,
  institutionName?: string | null
): string {
  let base = account.official_name || account.name;
  if (!base && institutionName) {
    const subtype = (account.subtype || '').toLowerCase();
    base =
      subtype.includes('credit') || subtype.includes('card')
        ? `${institutionName} Card`
        : institutionName;
  }
  if (!base) base = account.subtype || account.type || 'Card';
  const mask = account.mask ? ` ••${account.mask}` : '';
  return `${base}${mask}`;
}

/** Try to match a Plaid account to an existing payment method by mask or name. */
export function matchPaymentMethod(
  paymentMethods: PaymentMethodInfo[],
  account: PlaidAccountInfo,
  institutionName?: string | null
): PaymentMethodInfo | null {
  if (!paymentMethods.length) return null;

  if (account.mask) {
    const byMask = paymentMethods.find((pm) => pm.name.includes(account.mask!));
    if (byMask) return byMask;
  }

  const haystacks = [account.official_name, account.name, institutionName]
    .filter(Boolean)
    .map((s) => s!.toLowerCase());

  for (const pm of paymentMethods) {
    const pmLower = pm.name.toLowerCase();
    for (const h of haystacks) {
      if (h.includes(pmLower) || pmLower.includes(h)) return pm;
    }
  }
  return null;
}

/**
 * Link each Plaid account to a payment_method (match existing or create one).
 * Safe to call on every sync — only fills in missing links.
 */
export async function ensurePaymentMethodsForPlaidAccounts(
  supabase: SupabaseClient,
  plaidItemId: string,
  userId: string,
  institutionName?: string | null
): Promise<void> {
  const { data: accounts } = await supabase
    .from('plaid_accounts')
    .select('id, account_id, name, official_name, mask, type, subtype, payment_method_id')
    .eq('plaid_item_id', plaidItemId);

  if (!accounts?.length) return;

  const { data: allPms } = await supabase.from('payment_methods').select('id, name, is_shared');
  const pms: PaymentMethodInfo[] = [...(allPms || [])];

  for (const account of accounts) {
    if (account.payment_method_id) continue;

    let pm: PaymentMethodInfo | null = matchPaymentMethod(pms, account, institutionName);

    if (!pm) {
      const label = formatPlaidAccountLabel(account, institutionName);
      const { data: existing } = await supabase
        .from('payment_methods')
        .select('id, name, is_shared')
        .eq('name', label)
        .maybeSingle();

      if (existing) {
        pm = existing;
        if (!pms.some((p) => p.id === existing.id)) pms.push(existing);
      } else {
        const { data: created } = await supabase
          .from('payment_methods')
          .insert({ name: label, is_shared: true, owner_id: userId })
          .select('id, name, is_shared')
          .single();
        if (created) {
          pm = created;
          pms.push(created);
        }
      }
    }

    if (pm) {
      await supabase.from('plaid_accounts').update({ payment_method_id: pm.id }).eq('id', account.id);
    }
  }
}
