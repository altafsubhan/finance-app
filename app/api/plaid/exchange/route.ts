import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { syncPlaidItem } from '@/lib/plaid/sync';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isPlaidConfigured()) {
      return NextResponse.json({ error: 'Plaid is not configured.' }, { status: 503 });
    }

    const { public_token, institution } = await request.json();
    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const plaid = getPlaidClient();

    const exchange = await plaid.itemPublicTokenExchange({ public_token });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // Persist the item.
    const { data: itemRow, error: itemError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: user.id,
        item_id: itemId,
        access_token: accessToken,
        institution_id: institution?.institution_id || null,
        institution_name: institution?.name || null,
      })
      .select()
      .single();
    if (itemError) throw itemError;

    // Persist the accounts under this item.
    const accountsResp = await plaid.accountsGet({ access_token: accessToken });
    const accountRows = accountsResp.data.accounts.map((a) => ({
      plaid_item_id: itemRow.id,
      user_id: user.id,
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name || null,
      mask: a.mask || null,
      type: a.type || null,
      subtype: a.subtype || null,
    }));
    if (accountRows.length > 0) {
      await supabase
        .from('plaid_accounts')
        .upsert(accountRows, { onConflict: 'account_id', ignoreDuplicates: false });
    }

    // Initial pull so the inbox is populated immediately.
    let synced = { added: 0, modified: 0, removed: 0 };
    try {
      const result = await syncPlaidItem(supabase, {
        id: itemRow.id,
        user_id: user.id,
        access_token: accessToken,
        cursor: null,
      });
      synced = result;
    } catch (syncErr) {
      // Non-fatal: the item is linked; the cron / manual sync will retry.
      console.error('Initial Plaid sync failed:', syncErr);
    }

    return NextResponse.json({ item_id: itemRow.id, synced });
  } catch (error: any) {
    const detail = error?.response?.data || error?.message;
    return NextResponse.json({ error: 'Failed to link account', detail }, { status: 500 });
  }
}
