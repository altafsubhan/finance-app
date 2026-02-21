import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyBalanceDelta, computePaymentDeltas } from '@/lib/accounts/paymentBalanceAutomation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category_id, paid_by, payment_method, is_shared } = body;

    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id, amount, paid_by')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (category_id !== undefined) updateData.category_id = category_id;
    if (paid_by !== undefined) updateData.paid_by = paid_by;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
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

    if (paid_by !== undefined) {
      const deltas = computePaymentDeltas(existing.paid_by, paid_by, Number(existing.amount), Number(existing.amount));
      for (const [accountId, delta] of Object.entries(deltas)) {
        await applyBalanceDelta(
          supabase,
          accountId,
          user.id,
          delta,
          `Transaction payment update: ${data.description || 'Expense'} (${data.id})`
        );
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
