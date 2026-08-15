import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPlaidConfigured } from '@/lib/plaid/client';
import { importPlaidTransactionsSince } from '@/lib/plaid/importHistory';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Restore dismissed inbox rows and re-fetch linked-card transactions from Plaid
 * for a date range. Approved inbox rows and real transactions are untouched.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isPlaidConfigured()) {
      return NextResponse.json({ error: 'Plaid is not configured.' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const since = typeof body.since === 'string' ? body.since : '2026-06-01';
    if (!DATE_RE.test(since)) {
      return NextResponse.json({ error: 'since must be YYYY-MM-DD' }, { status: 400 });
    }

    const { data: restoredRows, error: restoreError } = await supabase
      .from('imported_transactions')
      .update({ status: 'pending' })
      .eq('user_id', user.id)
      .eq('status', 'dismissed')
      .gte('date', since)
      .select('id');
    if (restoreError) throw restoreError;

    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('id, user_id, access_token, cursor')
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (itemsError) throw itemsError;

    let imported = 0;
    const results = [];
    for (const item of items || []) {
      try {
        const result = await importPlaidTransactionsSince(supabase, item, since);
        imported += result.staged;
        results.push({ itemId: item.id, staged: result.staged });
      } catch (itemErr: any) {
        results.push({ itemId: item.id, error: itemErr?.message || 'import failed' });
      }
    }

    return NextResponse.json({
      since,
      restored: restoredRows?.length || 0,
      imported,
      items: results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
