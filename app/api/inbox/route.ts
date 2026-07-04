import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// List staged (inbox) transactions. Defaults to pending.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status') || 'pending';

    let query = supabase
      .from('imported_transactions')
      .select('*')
      .eq('is_pending', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
