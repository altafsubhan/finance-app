import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
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
    const { date, amount, description, category_id, payment_method, paid_by, month, quarter, year } = body;

    // Calculate quarter from month if not provided
    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(parseInt(month) / 3);
    }

    const updateData: any = {
      date: date || null,
      amount,
      description,
      category_id,
      payment_method,
      paid_by,
    };

    // Only update period fields if provided
    if (month !== undefined) updateData.month = month ? parseInt(month) : null;
    if (calculatedQuarter !== undefined) updateData.quarter = calculatedQuarter ? parseInt(calculatedQuarter) : null;
    if (year !== undefined) updateData.year = parseInt(year);

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

