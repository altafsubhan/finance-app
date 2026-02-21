import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyBalanceDelta, computePaymentDeltas } from '@/lib/accounts/paymentBalanceAutomation';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id, amount, paid_by')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const body = await request.json();
    const { date, amount, description, category_id, payment_method, paid_by, month, quarter, year, is_shared } = body;

    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(parseInt(month) / 3);
    }

    const updateData: any = {
      date: date || null,
      amount,
      description,
      category_id,
      payment_method,
      paid_by,
    };

    if (month !== undefined) updateData.month = month ? parseInt(month) : null;
    if (calculatedQuarter !== undefined) updateData.quarter = calculatedQuarter ? parseInt(calculatedQuarter) : null;
    if (year !== undefined) updateData.year = parseInt(year);
    if (is_shared !== undefined) updateData.is_shared = is_shared;

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const deltas = computePaymentDeltas(existing.paid_by, paid_by ?? null, Number(existing.amount), Number(amount));
    for (const [accountId, delta] of Object.entries(deltas)) {
      await applyBalanceDelta(
        supabase,
        accountId,
        user.id,
        delta,
        `Transaction payment update: ${description || 'Expense'} (${data.id})`
      );
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    void request;

    const { data: existing } = await supabase
      .from('transactions')
      .select('id, amount, paid_by, description')
      .eq('id', params.id)
      .single();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    if (existing) {
      const deltas = computePaymentDeltas(existing.paid_by, null, Number(existing.amount), 0);
      for (const [accountId, delta] of Object.entries(deltas)) {
        await applyBalanceDelta(
          supabase,
          accountId,
          user.id,
          delta,
          `Transaction deleted rollback: ${existing.description || 'Expense'} (${existing.id})`
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
