import type { PlaidAccountInfo } from './accounts';

/**
 * Explicit, deterministic Plaid account -> payment method overrides.
 *
 * These take priority over all automatic (mask / name) matching so specific
 * physical cards always land on the intended household payment method. Match by
 * card mask (last 4) when possible — it is the most reliable signal — and fall
 * back to a case-insensitive substring of the Plaid account name.
 */
export interface PlaidAccountOverride {
  mask?: string;
  nameIncludes?: string;
  paymentMethodName: string;
  /** Scope used only when the payment method has to be created. */
  isShared?: boolean;
}

export const PLAID_ACCOUNT_OVERRIDES: PlaidAccountOverride[] = [
  // Chase "Ultimate Rewards" card ending 1642 is Sobi's Chase Freedom.
  { mask: '1642', paymentMethodName: 'Sobi Chase Freedom', isShared: false },
  { mask: '5248', paymentMethodName: 'Chase Sapphire', isShared: false },
  { mask: '7339', paymentMethodName: 'Chase Amazon', isShared: false },
  { mask: '3356', paymentMethodName: 'Mano Chase Freedom', isShared: false },
  { mask: '8061', paymentMethodName: 'Mano Discover', isShared: false },
  { mask: '0360', paymentMethodName: 'Sobi Discover', isShared: false },
];

export function findAccountOverride(
  account: Pick<PlaidAccountInfo, 'mask' | 'name' | 'official_name'>
): PlaidAccountOverride | null {
  for (const override of PLAID_ACCOUNT_OVERRIDES) {
    if (override.mask && account.mask && account.mask === override.mask) {
      return override;
    }
    if (override.nameIncludes) {
      const needle = override.nameIncludes.toLowerCase();
      const haystacks = [account.official_name, account.name]
        .filter((s): s is string => Boolean(s))
        .map((s) => s.toLowerCase());
      if (haystacks.some((h) => h.includes(needle))) return override;
    }
  }
  return null;
}
