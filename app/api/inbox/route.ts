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
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = data || [];
    const uncategorizedPersonalIds = items
      .filter((item) => !item.suggested_category_id && item.is_shared === false)
      .map((item) => item.id);

    if (uncategorizedPersonalIds.length > 0) {
      await supabase
        .from('imported_transactions')
        .update({ is_shared: true })
        .in('id', uncategorizedPersonalIds)
        .eq('user_id', user.id);
    }

    const normalized = items.map((item) =>
      !item.suggested_category_id ? { ...item, is_shared: true } : item
    );

    return NextResponse.json({ items: normalized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
