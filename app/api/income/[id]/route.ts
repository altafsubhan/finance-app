import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const body = await request.json();
    const { account_id, amount, received_date, source, notes } = body;

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

    const { error } = await supabase
      .from('income_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
