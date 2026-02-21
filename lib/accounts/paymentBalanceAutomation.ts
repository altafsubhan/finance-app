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

export async function applyBalanceDelta(
  supabase: any,
  accountId: string,
  actorUserId: string,
  delta: number,
  note: string
) {
  if (!Number.isFinite(delta) || delta === 0) return;

  const { data: latestSnap, error: latestErr } = await supabase
    .from('account_snapshots')
    .select('balance')
    .eq('account_id', accountId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (latestErr || !latestSnap) {
    throw new Error('No existing account balance snapshot found for selected paid-by account');
  }

  const newBalance = Number(latestSnap.balance) + delta;
  const snapshotDate = new Date().toISOString().split('T')[0];

  const { error: upsertErr } = await supabase
    .from('account_snapshots')
    .upsert(
      {
        account_id: accountId,
        user_id: actorUserId,
        balance: newBalance,
        snapshot_date: snapshotDate,
        notes: note,
        snapshot_source: 'manual',
      },
      { onConflict: 'account_id,snapshot_date' }
    );

  if (upsertErr) {
    throw upsertErr;
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
