import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      from_account_name,
      to_account_name,
      to_account_id,
      date,
      notes,
      year,
      month,
      quarter,
    } = body;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    if (!to_account_id) {
      return NextResponse.json({ error: 'Destination shared account is required' }, { status: 400 });
    }

    const { data: toAccount, error: accountError } = await supabase
      .from('accounts')
      .select('id, user_id, is_shared')
      .eq('id', to_account_id)
      .single();

    if (accountError || !toAccount) {
      return NextResponse.json({ error: 'Shared account not found or not accessible' }, { status: 400 });
    }

    const description = `Transfer: ${from_account_name || 'Personal'} → ${to_account_name || 'Shared'}${notes ? ` (${notes})` : ''}`;

    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(parseInt(month) / 3);
    }

    const receivedDate = date || new Date().toISOString().split('T')[0];

    // 1. Create personal expense
    const { data: expense, error: expenseError } = await supabase
      .from('transactions')
      .insert({
        date: date || null,
        amount: parsedAmount,
        description,
        category_id: null,
        payment_method: 'Other',
        paid_by: null,
        month: month ? parseInt(month) : null,
        quarter: calculatedQuarter ? parseInt(calculatedQuarter) : null,
        year: parseInt(year) || new Date().getFullYear(),
        is_shared: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (expenseError) {
      throw expenseError;
    }

    // 2. Create shared income entry on the destination account
    const incomeSource = `Transfer from ${from_account_name || 'personal account'}`;
    const incomeNotes = notes ? notes.trim() : null;

    const { data: incomeEntry, error: incomeError } = await supabase
      .from('income_entries')
      .insert({
        user_id: user.id,
        account_id: to_account_id,
        entry_type: 'income',
        amount: parsedAmount,
        received_date: receivedDate,
        source: incomeSource,
        notes: incomeNotes,
      })
      .select()
      .single();

    if (incomeError) {
      throw incomeError;
    }

    // Auto-adjust balance snapshots if enabled
    const shouldAutoAdjust =
      toAccount.user_id === user.id &&
      (await isIncomeAutoAdjustEnabledForUser(supabase, user.id));
    if (shouldAutoAdjust) {
      await syncIncomeSnapshotsForAccount(supabase, to_account_id, user.id);
    }

    return NextResponse.json({
      expense,
      income_entry: incomeEntry,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
