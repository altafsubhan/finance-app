import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPlaidConfigured } from '@/lib/plaid/client';
import { syncPlaidItem } from '@/lib/plaid/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled daily sync (configured in vercel.json). Uses the service-role client
 * to iterate every active Plaid item across the household. Protected by
 * CRON_SECRET: Vercel Cron sends it as a Bearer token automatically.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: 'Plaid is not configured.' }, { status: 503 });
  }

  try {
    const supabase = createAdminClient();
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

    return NextResponse.json({ ok: true, items: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
