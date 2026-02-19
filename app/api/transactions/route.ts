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
    const month = searchParams.get('month');
    const quarter = searchParams.get('quarter');
    const categoryIds = searchParams.getAll('category_id');
    const paymentMethod = searchParams.get('payment_method');
    const isSharedParam = searchParams.get('is_shared');

    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*)
      `)
      .order('year', { ascending: false })
      .order('quarter', { ascending: false, nullsFirst: false })
      .order('month', { ascending: false, nullsFirst: false })
      .order('date', { ascending: false, nullsFirst: true });

    if (isSharedParam !== null) {
      query = query.eq('is_shared', isSharedParam === 'true');
    }

    // Filter by year (using year field)
    if (year) {
      query = query.eq('year', parseInt(year));
    }

    // Filter by quarter (using quarter field)
    if (quarter) {
      query = query.eq('quarter', parseInt(quarter));
    }

    // Filter by month (using month field)
    if (month) {
      query = query.eq('month', parseInt(month));
    }

    // Filter by category IDs (multiple categories)
    if (categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    }
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const paidBy = searchParams.get('paid_by');
    if (paidBy !== null && paidBy !== '') {
      if (paidBy === 'null') {
        query = query.is('paid_by', null);
      } else {
        query = query.eq('paid_by', paidBy);
      }
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
    const { date, amount, description, category_id, payment_method, paid_by, month, quarter, year, is_shared } = body;

    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(month / 3);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date: date || null,
        amount,
        description,
        category_id,
        payment_method,
        paid_by,
        month: month ? parseInt(month) : null,
        quarter: calculatedQuarter ? parseInt(calculatedQuarter) : null,
        year: parseInt(year),
        is_shared: is_shared !== undefined ? is_shared : true,
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

