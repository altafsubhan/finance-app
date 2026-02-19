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

export async function syncIncomeSnapshotsForAccount(
  supabase: any,
  accountId: string,
  actorUserId: string
): Promise<void> {
  // Remove previous derived income rows first; they will be rebuilt from source data.
  const { error: deleteIncomeSnapshotsError } = await supabase
    .from('account_snapshots')
    .delete()
    .eq('account_id', accountId)
    .eq('snapshot_source', 'income');
  if (deleteIncomeSnapshotsError) throw deleteIncomeSnapshotsError;

  const { data: manualRows, error: manualRowsError } = await supabase
    .from('account_snapshots')
    .select('snapshot_date,balance')
    .eq('account_id', accountId)
    .eq('snapshot_source', 'manual')
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (manualRowsError) throw manualRowsError;

  const latestManual = manualRows?.[0] || null;
  if (!latestManual) {
    return;
  }

  const { data: incomeRows, error: incomeRowsError } = await supabase
    .from('income_entries')
    .select('received_date,amount')
    .eq('account_id', accountId)
    .gt('received_date', latestManual.snapshot_date)
    .order('received_date', { ascending: true });
  if (incomeRowsError) throw incomeRowsError;

  if (!incomeRows || incomeRows.length === 0) {
    return;
  }

  const totalsByDate: Record<string, number> = {};
  for (const row of incomeRows as Array<{ received_date: string; amount: number | string }>) {
    const dateKey = row.received_date;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    totalsByDate[dateKey] = (totalsByDate[dateKey] || 0) + amount;
  }

  const sortedDates = Object.keys(totalsByDate).sort();
  if (sortedDates.length === 0) {
    return;
  }

  let runningBalance = Number(latestManual.balance);
  const rowsToInsert = sortedDates.map((snapshotDate) => {
    runningBalance += totalsByDate[snapshotDate];
    return {
      account_id: accountId,
      user_id: actorUserId,
      balance: runningBalance,
      snapshot_date: snapshotDate,
      notes: INCOME_SNAPSHOT_NOTE,
      snapshot_source: 'income',
    };
  });

  const { error: insertIncomeSnapshotsError } = await supabase
    .from('account_snapshots')
    .insert(rowsToInsert);
  if (insertIncomeSnapshotsError) throw insertIncomeSnapshotsError;
}
