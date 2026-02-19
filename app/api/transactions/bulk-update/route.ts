import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transaction_ids, updates } = body;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const updateData: any = {};
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.payment_method !== undefined) updateData.payment_method = updates.payment_method;
    if (updates.paid_by !== undefined) updateData.paid_by = updates.paid_by;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.is_shared !== undefined) updateData.is_shared = updates.is_shared;

    // Update all transactions (RLS policies handle authorization)
    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .in('id', transaction_ids)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: `Successfully updated ${data?.length || 0} transactions`,
      count: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

