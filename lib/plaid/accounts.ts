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

/** Try to match a Plaid account to an existing payment method by mask or full label. */
export function matchPaymentMethod(
  paymentMethods: PaymentMethodInfo[],
  account: PlaidAccountInfo,
  institutionName?: string | null
): PaymentMethodInfo | null {
  if (!paymentMethods.length) return null;

  // Last-4 mask is the most reliable signal across household payment methods.
  if (account.mask) {
    const byMask = paymentMethods.find((pm) => pm.name.includes(account.mask!));
    if (byMask) return byMask;
  }

  // Exact label match for what we would create for this Plaid account.
  const label = formatPlaidAccountLabel(account, institutionName);
  const byLabel = paymentMethods.find((pm) => pm.name === label);
  if (byLabel) return byLabel;

  // Match on the full account name only — never on institution alone, which would
  // incorrectly link "Discover" to household labels like "Mano Discover".
  const accountNames = [account.official_name, account.name]
    .filter((s): s is string => Boolean(s && s.trim().length >= 6))
    .map((s) => s.toLowerCase());

  for (const pm of paymentMethods) {
    const pmLower = pm.name.toLowerCase();
    for (const name of accountNames) {
      if (pmLower.includes(name) || name.includes(pmLower)) return pm;
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
    const linkedPm = account.payment_method_id
      ? pms.find((p) => p.id === account.payment_method_id)
      : null;
    const maskMismatch =
      Boolean(account.mask && linkedPm && !linkedPm.name.includes(account.mask));

    if (account.payment_method_id && !maskMismatch) continue;

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
