import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Approve staged inbox rows: create real transactions from them and mark the
 * staged rows approved. Amounts are stored as absolute spend to match the rest
 * of the app. Personal charges are attributed to the approver and marked
 * claimed so they immediately count as "accounted for".
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from('imported_transactions')
      .select('*')
      .in('id', ids)
      .eq('status', 'pending');
    if (rowsError) throw rowsError;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No pending rows found' }, { status: 404 });
    }

    let created = 0;
    for (const row of rows) {
      const date: string | null = row.date || null;
      const month = date ? new Date(date).getUTCMonth() + 1 : null;
      const quarter = month ? Math.ceil(month / 3) : null;
      const year = date ? new Date(date).getUTCFullYear() : new Date().getFullYear();
      const isShared = row.is_shared ?? true;

      const insertPayload: any = {
        date,
        amount: Math.abs(parseFloat(row.amount)),
        description: row.description || row.merchant_name || '',
        category_id: row.suggested_category_id || null,
        payment_method: row.payment_method || 'Other',
        paid_by: null,
        year,
        month,
        quarter,
        is_shared: isShared,
        user_id: user.id,
        // Approving in the inbox IS the human review, so it's claimed. Personal
        // charges are attributed to the approver; shared stay joint (no attribution).
        claim_status: 'claimed',
        attributed_to: isShared ? null : user.id,
      };

      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert(insertPayload)
        .select()
        .single();
      if (txError) throw txError;

      await supabase
        .from('imported_transactions')
        .update({ status: 'approved', approved_transaction_id: tx.id })
        .eq('id', row.id);

      created += 1;
    }

    return NextResponse.json({ created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
