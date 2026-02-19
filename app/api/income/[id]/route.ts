import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccountOwnerId,
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';

const ALLOWED_ENTRY_TYPES = ['income', '401k', 'hsa'] as const;
type IncomeEntryType = (typeof ALLOWED_ENTRY_TYPES)[number];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { data: existingEntry, error: existingEntryError } = await supabase
      .from('income_entries')
      .select('id,account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (existingEntryError || !existingEntry) {
      return NextResponse.json({ error: 'Income entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const { account_id, amount, received_date, source, notes, entry_type } = body;

    const updateFields: Record<string, unknown> = {};

    if (account_id !== undefined) {
      if (!account_id || typeof account_id !== 'string') {
        return NextResponse.json({ error: 'Invalid account' }, { status: 400 });
      }

      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', account_id)
        .single();

      if (accountError || !account) {
        return NextResponse.json(
          { error: 'Account not found or not accessible' },
          { status: 400 }
        );
      }

      updateFields.account_id = account_id;
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a number greater than zero' },
          { status: 400 }
        );
      }
      updateFields.amount = parsedAmount;
    }

    if (received_date !== undefined) {
      if (!received_date || typeof received_date !== 'string') {
        return NextResponse.json({ error: 'Invalid received date' }, { status: 400 });
      }
      updateFields.received_date = received_date;
    }

    if (entry_type !== undefined) {
      if (
        typeof entry_type !== 'string' ||
        !ALLOWED_ENTRY_TYPES.includes(entry_type as IncomeEntryType)
      ) {
        return NextResponse.json(
          { error: 'Entry type must be one of: income, 401k, hsa' },
          { status: 400 }
        );
      }
      updateFields.entry_type = entry_type;
    }

    if (source !== undefined) {
      updateFields.source =
        typeof source === 'string' && source.trim().length > 0 ? source.trim() : null;
    }

    if (notes !== undefined) {
      updateFields.notes =
        typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('income_entries')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Income entry not found' }, { status: 404 });
      }
      throw error;
    }

    const affectedAccountIds = Array.from(
      new Set([
        String(existingEntry.account_id),
        String(data.account_id),
      ])
    );

    let autoAdjustEnabled: boolean | null = null;
    for (const affectedAccountId of affectedAccountIds) {
      const ownerId = await getAccountOwnerId(supabase, affectedAccountId);
      if (!ownerId || ownerId !== user.id) continue;

      if (autoAdjustEnabled === null) {
        autoAdjustEnabled = await isIncomeAutoAdjustEnabledForUser(supabase, user.id);
      }
      if (!autoAdjustEnabled) continue;

      await syncIncomeSnapshotsForAccount(supabase, affectedAccountId, user.id);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: existingEntry, error: existingEntryError } = await supabase
      .from('income_entries')
      .select('id,account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (existingEntryError || !existingEntry) {
      return NextResponse.json({ error: 'Income entry not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('income_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    const ownerId = await getAccountOwnerId(supabase, String(existingEntry.account_id));
    if (ownerId === user.id) {
      const shouldAutoAdjust = await isIncomeAutoAdjustEnabledForUser(supabase, user.id);
      if (shouldAutoAdjust) {
        await syncIncomeSnapshotsForAccount(
          supabase,
          String(existingEntry.account_id),
          user.id
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
