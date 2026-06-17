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
    const {
      category_id, paid_by, payment_method, is_shared,
      attributed_to, claim_status, details_private,
    } = body;

    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id, amount, paid_by, user_id, attributed_to')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Is the caller the "spend owner" (creator or the person it's attributed to)?
    // Non-owners (i.e. the partner reconciling a shared card) may only change
    // attribution fields, never the private details.
    const isOwner =
      existing.user_id === user.id ||
      (existing.attributed_to && existing.attributed_to === user.id);

    const updateData: any = {};
    if (isOwner) {
      if (category_id !== undefined) updateData.category_id = category_id;
      if (paid_by !== undefined) updateData.paid_by = paid_by;
      if (payment_method !== undefined) updateData.payment_method = payment_method;
    }
    if (is_shared !== undefined) {
      updateData.is_shared = is_shared;
      // Moving a shared expense to personal: claim ownership so RLS continues
      // to allow the caller to edit it.
      if (is_shared === false) {
        updateData.user_id = user.id;
      }
    }
    if (attributed_to !== undefined) updateData.attributed_to = attributed_to;
    if (claim_status !== undefined) updateData.claim_status = claim_status;
    if (details_private !== undefined) updateData.details_private = details_private;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No permitted fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (isOwner && paid_by !== undefined) {
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
