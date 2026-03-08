const INCOME_SNAPSHOT_NOTE = 'Income';

export async function isIncomeAutoAdjustEnabledForUser(
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('auto_adjust_balances_from_income')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    throw error;
  }

  return Boolean(data?.auto_adjust_balances_from_income);
}

export async function getAccountOwnerId(
  supabase: any,
  accountId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('id', accountId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data?.user_id || null;
}

/**
 * Rebuild income-derived balance snapshots for an account.
 *
 * Creates one snapshot row **per income entry** (rather than one per day) so that
 * every individual record is visible in the balance history.
 *
 * Entries with skip_balance_update = true are excluded.
 */
export async function syncIncomeSnapshotsForAccount(
  supabase: any,
  accountId: string,
  actorUserId: string
): Promise<void> {
  // Remove previous derived income rows; they will be rebuilt from source data.
  const { error: deleteIncomeSnapshotsError } = await supabase
    .from('account_snapshots')
    .delete()
    .eq('account_id', accountId)
    .eq('snapshot_source', 'income');
  if (deleteIncomeSnapshotsError) throw deleteIncomeSnapshotsError;

  // Find the latest non-income snapshot as the baseline.
  const { data: baselineRows, error: baselineError } = await supabase
    .from('account_snapshots')
    .select('snapshot_date,balance')
    .eq('account_id', accountId)
    .neq('snapshot_source', 'income')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (baselineError) throw baselineError;

  const latestBaseline = baselineRows?.[0] || null;
  if (!latestBaseline) {
    return;
  }

  // Fetch individual income entries after the baseline date,
  // excluding entries where the user opted out of balance updates.
  const { data: incomeRows, error: incomeRowsError } = await supabase
    .from('income_entries')
    .select('id,received_date,amount,source,skip_balance_update')
    .eq('account_id', accountId)
    .gt('received_date', latestBaseline.snapshot_date)
    .order('received_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (incomeRowsError) throw incomeRowsError;

  if (!incomeRows || incomeRows.length === 0) {
    return;
  }

  // Filter out entries that opted out of balance updates
  const eligibleRows = incomeRows.filter(
    (row: any) => !row.skip_balance_update
  );

  if (eligibleRows.length === 0) {
    return;
  }

  let runningBalance = Number(latestBaseline.balance);
  const rowsToInsert = eligibleRows.map(
    (entry: { id: string; received_date: string; amount: number | string; source: string | null }) => {
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount)) return null;
      runningBalance += amount;
      return {
        account_id: accountId,
        user_id: actorUserId,
        balance: runningBalance,
        snapshot_date: entry.received_date,
        notes: entry.source
          ? `${INCOME_SNAPSHOT_NOTE}: ${entry.source}`
          : INCOME_SNAPSHOT_NOTE,
        snapshot_source: 'income',
        reference_type: 'income_entry',
        reference_id: entry.id,
      };
    }
  ).filter(Boolean);

  if (rowsToInsert.length === 0) {
    return;
  }

  const { error: insertIncomeSnapshotsError } = await supabase
    .from('account_snapshots')
    .insert(rowsToInsert);
  if (insertIncomeSnapshotsError) throw insertIncomeSnapshotsError;
}
