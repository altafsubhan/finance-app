import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9.-]{1,15}$/.test(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('account_portfolio_holdings')
      .select('*')
      .eq('account_id', id)
      .order('symbol', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { symbol, shares } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const normalizedSymbol = normalizeSymbol(symbol);
    if (!isValidSymbol(normalizedSymbol)) {
      return NextResponse.json(
        { error: 'Symbol must be 1-15 chars using letters, numbers, dot, or dash' },
        { status: 400 }
      );
    }

    const parsedShares = Number(shares);
    if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
      return NextResponse.json(
        { error: 'Shares must be a number greater than zero' },
        { status: 400 }
      );
    }

    // Only account owners can modify portfolio composition.
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('account_portfolio_holdings')
      .insert({
        account_id: id,
        user_id: user.id,
        symbol: normalizedSymbol,
        shares: parsedShares,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This symbol already exists for the account. Edit shares instead.' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
