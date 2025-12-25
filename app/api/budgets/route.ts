import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const categoryId = searchParams.get('category_id');

    let query = supabase
      .from('budgets')
      .select(`
        *,
        category:categories(*)
      `);
      // RLS policies handle user filtering for shared access

    if (year) {
      query = query.eq('year', parseInt(year));
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category_id, year, period, period_value, amount } = body;

    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        category_id,
        year: parseInt(year),
        period,
        period_value: period_value ? parseInt(period_value) : null,
        amount: parseFloat(amount),
        user_id: user.id,
      }, {
        onConflict: 'category_id,year,period,period_value'
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

