import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/plaid/accounts/[id]
// Updates is_synced for a single plaid_accounts row. Ownership is enforced by
// RLS — only the linked user (or their household partner) can modify the row.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = await request.json();
    if (typeof body.is_synced !== 'boolean') {
      return NextResponse.json({ error: 'is_synced (boolean) is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('plaid_accounts')
      .update({ is_synced: body.is_synced })
      .eq('id', id)
      .select('id, is_synced')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
