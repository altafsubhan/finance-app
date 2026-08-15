import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Bulk-dismiss staged rows. Only marks the inbox rows dismissed; never deletes
// real transactions.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }

    const { error } = await supabase
      .from('imported_transactions')
      .update({ status: 'dismissed' })
      .in('id', ids)
      .eq('user_id', user.id);
    if (error) throw error;

    return NextResponse.json({ dismissed: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
