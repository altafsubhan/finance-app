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
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // RLS policies handle authorization for shared access
    const { data, error } = await supabase
      .from('payment_methods')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      // Handle duplicate name error
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Payment method already exists' }, { status: 400 });
      }
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

    // First get the payment method name
    const { data: paymentMethod, error: fetchError } = await supabase
      .from('payment_methods')
      .select('name')
      .eq('id', params.id)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Check if payment method is used in any transactions (by name, since we store name in transactions)
    const { data: transactions, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_method', paymentMethod.name)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (transactions && transactions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete payment method that is used in transactions' },
        { status: 400 }
      );
    }

    // RLS policies handle authorization for shared access
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Payment method deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

