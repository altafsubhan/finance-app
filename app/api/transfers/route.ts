import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      from_account_name,
      to_account_name,
      date,
      notes,
      year,
      month,
      quarter,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const description = `Transfer: ${from_account_name || 'Personal'} → ${to_account_name || 'Shared'}${notes ? ` (${notes})` : ''}`;

    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(parseInt(month) / 3);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date: date || null,
        amount: parseFloat(amount),
        description,
        category_id: null,
        payment_method: 'Other',
        paid_by: null,
        month: month ? parseInt(month) : null,
        quarter: calculatedQuarter ? parseInt(calculatedQuarter) : null,
        year: parseInt(year) || new Date().getFullYear(),
        is_shared: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
