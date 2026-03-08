import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccountOwnerId,
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('account_snapshots')
      .select('*')
      .eq('account_id', id)
      .order('snapshot_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { balance, balance_adjustment, snapshot_date, notes } = body;

    if (balance === undefined && balance_adjustment === undefined) {
      return NextResponse.json(
        { error: 'Either balance or balance_adjustment is required' },
        { status: 400 }
      );
    }

    if (!snapshot_date) {
      return NextResponse.json(
        { error: 'snapshot_date is required' },
        { status: 400 }
      );
    }

    let finalBalance: number;

    if (balance_adjustment !== undefined) {
      const { data: latestSnap, error: snapErr } = await supabase
        .from('account_snapshots')
        .select('balance')
        .eq('account_id', id)
        .order('snapshot_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (snapErr || !latestSnap) {
        return NextResponse.json(
          { error: 'No existing balance snapshot found to adjust' },
          { status: 400 }
        );
      }

      finalBalance = parseFloat(latestSnap.balance) + parseFloat(balance_adjustment);
    } else {
      finalBalance = parseFloat(balance);
    }

    // Insert a new snapshot row (no upsert – allows multiple entries per day)
    const { data, error } = await supabase
      .from('account_snapshots')
      .insert({
        account_id: id,
        user_id: user.id,
        balance: finalBalance,
        snapshot_date,
        notes: notes || null,
        snapshot_source: 'manual',
        reference_type: 'manual_entry',
        reference_id: null,
      })
      .select()
      .single();

    if (error) throw error;

    const ownerId = await getAccountOwnerId(supabase, id);
    if (ownerId === user.id) {
      const shouldAutoAdjust = await isIncomeAutoAdjustEnabledForUser(supabase, user.id);
      if (shouldAutoAdjust) {
        await syncIncomeSnapshotsForAccount(supabase, id, user.id);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
