import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ENTRY_TYPES = ['income', '401k', 'hsa'] as const;
type IncomeEntryType = (typeof ALLOWED_ENTRY_TYPES)[number];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const yearParam = request.nextUrl.searchParams.get('year');
    let query = supabase
      .from('income_entries')
      .select('*')
      .order('received_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (yearParam !== null) {
      const year = Number(yearParam);
      if (!Number.isInteger(year) || year < 1900 || year > 3000) {
        return NextResponse.json({ error: 'Invalid year filter' }, { status: 400 });
      }

      query = query
        .gte('received_date', `${year}-01-01`)
        .lte('received_date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { account_id, amount, received_date, source, notes, entry_type } = body;

    if (!account_id || typeof account_id !== 'string') {
      return NextResponse.json({ error: 'Account is required' }, { status: 400 });
    }

    if (!received_date || typeof received_date !== 'string') {
      return NextResponse.json({ error: 'Received date is required' }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a number greater than zero' },
        { status: 400 }
      );
    }

    const parsedEntryType = (entry_type ?? 'income') as IncomeEntryType;
    if (!ALLOWED_ENTRY_TYPES.includes(parsedEntryType)) {
      return NextResponse.json(
        { error: 'Entry type must be one of: income, 401k, hsa' },
        { status: 400 }
      );
    }

    // RLS-aware lookup ensures the selected account is visible to this user.
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found or not accessible' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('income_entries')
      .insert({
        user_id: user.id,
        account_id,
        entry_type: parsedEntryType,
        amount: parsedAmount,
        received_date,
        source: typeof source === 'string' && source.trim().length > 0 ? source.trim() : null,
        notes: typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
