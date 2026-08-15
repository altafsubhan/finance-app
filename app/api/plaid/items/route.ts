import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';

// List linked institutions (with their accounts) for the current user only.
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('id, institution_name, status, last_synced_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const itemIds = (items || []).map((i) => i.id);
    let accounts: any[] = [];
    if (itemIds.length > 0) {
      const { data: accs } = await supabase
        .from('plaid_accounts')
        .select('id, plaid_item_id, name, mask, type, subtype, payment_method_id, is_synced')
        .in('plaid_item_id', itemIds);
      accounts = accs || [];
    }

    const withAccounts = (items || []).map((i) => ({
      ...i,
      accounts: accounts.filter((a) => a.plaid_item_id === i.id),
    }));

    return NextResponse.json({ items: withAccounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Unlink an institution. Removes the Plaid item + its accounts. Does NOT delete
// any already-approved transactions.
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: item } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('id', id)
      .single();

    if (item && isPlaidConfigured()) {
      try {
        await getPlaidClient().itemRemove({ access_token: item.access_token });
      } catch (e) {
        console.error('Plaid itemRemove failed (continuing):', e);
      }
    }

    const { error } = await supabase.from('plaid_items').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
