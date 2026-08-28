import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/plaid/accounts/[id]/remap
 *
 * Reassigns a Plaid account to a different (or new) payment method and
 * optionally backfills past transactions that still carry the old name.
 *
 * Body:
 *   { payment_method_id: string,   // UUID of the target payment method
 *     backfill?: boolean }          // default false
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { payment_method_id, backfill = false } = body;
    if (!payment_method_id) {
      return NextResponse.json({ error: 'payment_method_id is required' }, { status: 400 });
    }

    // Fetch current plaid account — confirm it belongs to this user
    const { data: account, error: accountErr } = await supabase
      .from('plaid_accounts')
      .select('id, name, official_name, mask, payment_method_id, plaid_item_id')
      .eq('id', params.id)
      .single();
    if (accountErr || !account) {
      return NextResponse.json({ error: 'Plaid account not found' }, { status: 404 });
    }

    // Confirm the plaid_item belongs to this user
    const { data: item } = await supabase
      .from('plaid_items')
      .select('id')
      .eq('id', account.plaid_item_id)
      .eq('user_id', user.id)
      .single();
    if (!item) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch the old PM name (if any) so we can backfill
    let oldPmName: string | null = null;
    if (account.payment_method_id) {
      const { data: oldPm } = await supabase
        .from('payment_methods')
        .select('name')
        .eq('id', account.payment_method_id)
        .single();
      oldPmName = oldPm?.name ?? null;
    }

    // Fetch the new PM name
    const { data: newPm, error: pmErr } = await supabase
      .from('payment_methods')
      .select('id, name')
      .eq('id', payment_method_id)
      .single();
    if (pmErr || !newPm) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Count transactions that would be updated before touching anything
    let transactionCount = 0;
    let inboxCount = 0;
    if (backfill && oldPmName && oldPmName !== newPm.name) {
      const { count: txCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id);
      transactionCount = txCount ?? 0;

      const { count: ibCount } = await supabase
        .from('imported_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id);
      inboxCount = ibCount ?? 0;
    }

    // 1. Update plaid_accounts.payment_method_id
    const { error: updateErr } = await supabase
      .from('plaid_accounts')
      .update({ payment_method_id: newPm.id })
      .eq('id', params.id);
    if (updateErr) throw updateErr;

    // 2. Backfill transactions and inbox if requested
    let updatedTransactions = 0;
    let updatedInbox = 0;
    if (backfill && oldPmName && oldPmName !== newPm.name) {
      const { count: txUpdated } = await supabase
        .from('transactions')
        .update({ payment_method: newPm.name })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id)
        .select('id');
      updatedTransactions = txUpdated ?? 0;

      const { count: ibUpdated } = await supabase
        .from('imported_transactions')
        .update({ payment_method: newPm.name })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id)
        .select('id');
      updatedInbox = ibUpdated ?? 0;
    }

    return NextResponse.json({
      success: true,
      newPaymentMethod: newPm.name,
      backfilled: backfill,
      updatedTransactions,
      updatedInbox,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/plaid/accounts/[id]/remap
 * Returns a preview: how many transactions would be updated if backfill were applied.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const newPmId = request.nextUrl.searchParams.get('new_payment_method_id');
    if (!newPmId) return NextResponse.json({ error: 'new_payment_method_id is required' }, { status: 400 });

    const { data: account } = await supabase
      .from('plaid_accounts')
      .select('id, payment_method_id, plaid_item_id')
      .eq('id', params.id)
      .single();
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: item } = await supabase
      .from('plaid_items')
      .select('id')
      .eq('id', account.plaid_item_id)
      .eq('user_id', user.id)
      .single();
    if (!item) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let oldPmName: string | null = null;
    if (account.payment_method_id) {
      const { data: oldPm } = await supabase
        .from('payment_methods')
        .select('name')
        .eq('id', account.payment_method_id)
        .single();
      oldPmName = oldPm?.name ?? null;
    }

    const { data: newPm } = await supabase
      .from('payment_methods')
      .select('name')
      .eq('id', newPmId)
      .single();

    let transactionCount = 0;
    let inboxCount = 0;
    if (oldPmName && newPm && oldPmName !== newPm.name) {
      const { count: txCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id);
      transactionCount = txCount ?? 0;

      const { count: ibCount } = await supabase
        .from('imported_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', oldPmName)
        .eq('user_id', user.id);
      inboxCount = ibCount ?? 0;
    }

    return NextResponse.json({
      oldPmName,
      newPmName: newPm?.name ?? null,
      transactionCount,
      inboxCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
