import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncIncomeSnapshotsForAccount } from '@/lib/accounts/incomeSnapshotAutomation';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('auto_adjust_balances_from_income')
      .eq('id', user.id)
      .single();

    if (error) {
      // If the profile row is missing for some reason, return safe defaults.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ auto_adjust_balances_from_income: false });
      }
      throw error;
    }

    return NextResponse.json({
      auto_adjust_balances_from_income: data?.auto_adjust_balances_from_income ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { auto_adjust_balances_from_income } = body;

    if (typeof auto_adjust_balances_from_income !== 'boolean') {
      return NextResponse.json(
        { error: 'auto_adjust_balances_from_income must be a boolean' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        auto_adjust_balances_from_income,
      })
      .eq('id', user.id)
      .select('auto_adjust_balances_from_income')
      .single();

    if (error) throw error;

    if (auto_adjust_balances_from_income) {
      const { data: ownedAccounts, error: ownedAccountsError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id);
      if (ownedAccountsError) throw ownedAccountsError;

      for (const account of ownedAccounts || []) {
        await syncIncomeSnapshotsForAccount(supabase, account.id, user.id);
      }
    }

    return NextResponse.json({
      auto_adjust_balances_from_income: data.auto_adjust_balances_from_income,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
