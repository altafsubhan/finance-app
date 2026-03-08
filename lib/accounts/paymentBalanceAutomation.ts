import {
  getAccountOwnerId,
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';

export const LEGACY_PAID_BY_VALUES = new Set(['joint', 'mano', 'sobi']);

export function isAccountId(value: string | null | undefined): value is string {
  if (!value) return false;
  if (LEGACY_PAID_BY_VALUES.has(value)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Apply a balance delta by inserting a new snapshot row.
 * Each call creates its own row so every record that touches an account
 * balance is independently visible.
 */
export async function applyBalanceDelta(
  supabase: any,
  accountId: string,
  actorUserId: string,
  delta: number,
  note: string,
  options?: {
    snapshotSource?: string;
    referenceType?: string;
    referenceId?: string;
    snapshotDate?: string;
  }
) {
  if (!Number.isFinite(delta) || delta === 0) return;

  const { data: latestSnap, error: latestErr } = await supabase
    .from('account_snapshots')
    .select('balance')
    .eq('account_id', accountId)
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestErr || !latestSnap) {
    throw new Error('No existing account balance snapshot found for selected paid-by account');
  }

  const newBalance = Number(latestSnap.balance) + delta;
  const snapshotDate = options?.snapshotDate || new Date().toISOString().split('T')[0];

  const { error: insertErr } = await supabase
    .from('account_snapshots')
    .insert({
      account_id: accountId,
      user_id: actorUserId,
      balance: newBalance,
      snapshot_date: snapshotDate,
      notes: note,
      snapshot_source: options?.snapshotSource || 'manual',
      reference_type: options?.referenceType || null,
      reference_id: options?.referenceId || null,
    });

  if (insertErr) {
    throw insertErr;
  }

  const ownerId = await getAccountOwnerId(supabase, accountId);
  if (ownerId === actorUserId) {
    const shouldAutoAdjust = await isIncomeAutoAdjustEnabledForUser(supabase, actorUserId);
    if (shouldAutoAdjust) {
      await syncIncomeSnapshotsForAccount(supabase, accountId, actorUserId);
    }
  }
}

export function computePaymentDeltas(
  oldPaidBy: string | null,
  newPaidBy: string | null,
  oldAmount: number,
  newAmount: number
): Record<string, number> {
  const deltas: Record<string, number> = {};

  if (isAccountId(oldPaidBy)) {
    deltas[oldPaidBy] = (deltas[oldPaidBy] || 0) + Math.abs(oldAmount);
  }

  if (isAccountId(newPaidBy)) {
    deltas[newPaidBy] = (deltas[newPaidBy] || 0) - Math.abs(newAmount);
  }

  return deltas;
}
