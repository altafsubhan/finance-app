import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPlaidConfigured } from '@/lib/plaid/client';
import { syncPlaidItem } from '@/lib/plaid/sync';

/**
 * User-triggered "refresh now". Syncs every Plaid item the household can see
 * (RLS scopes this) into the review inbox.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isPlaidConfigured()) {
      return NextResponse.json({ error: 'Plaid is not configured.' }, { status: 503 });
    }

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('id, user_id, access_token, cursor')
      .eq('status', 'active');
    if (error) throw error;

    const results = [];
    for (const item of items || []) {
      try {
        results.push(await syncPlaidItem(supabase, item));
      } catch (itemErr: any) {
        await supabase.from('plaid_items').update({ status: 'error' }).eq('id', item.id);
        results.push({ itemId: item.id, error: itemErr?.message || 'sync failed' });
      }
    }

    const totalAdded = results.reduce((s: number, r: any) => s + (r.added || 0), 0);
    return NextResponse.json({ items: results.length, added: totalAdded, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
