import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category_id, paid_by, payment_method } = body;

    const updateData: any = {};
    if (category_id !== undefined) updateData.category_id = category_id;
    if (paid_by !== undefined) updateData.paid_by = paid_by;
    if (payment_method !== undefined) updateData.payment_method = payment_method;

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', params.id)
      // RLS policies handle authorization for shared access
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

