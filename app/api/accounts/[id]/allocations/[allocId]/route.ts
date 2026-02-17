import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; allocId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allocId } = await params;
    const body = await request.json();
    const { label, amount, color, allocation_type } = body;

    const updateFields: Record<string, any> = {};
    if (label !== undefined) updateFields.label = label;
    if (amount !== undefined) updateFields.amount = parseFloat(amount);
    if (allocation_type !== undefined) updateFields.allocation_type = allocation_type;
    if (color !== undefined) updateFields.color = color || null;

    const { data, error } = await supabase
      .from('balance_allocations')
      .update(updateFields)
      .eq('id', allocId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; allocId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allocId } = await params;

    const { error } = await supabase
      .from('balance_allocations')
      .delete()
      .eq('id', allocId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
