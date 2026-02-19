import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9.-]{1,15}$/.test(value);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; holdingId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, holdingId } = await params;
    const body = await request.json();
    const { symbol, shares } = body;

    const updateFields: Record<string, unknown> = {};

    if (symbol !== undefined) {
      if (!symbol || typeof symbol !== 'string') {
        return NextResponse.json({ error: 'Symbol must be a string' }, { status: 400 });
      }
      const normalizedSymbol = normalizeSymbol(symbol);
      if (!isValidSymbol(normalizedSymbol)) {
        return NextResponse.json(
          { error: 'Symbol must be 1-15 chars using letters, numbers, dot, or dash' },
          { status: 400 }
        );
      }
      updateFields.symbol = normalizedSymbol;
    }

    if (shares !== undefined) {
      const parsedShares = Number(shares);
      if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
        return NextResponse.json(
          { error: 'Shares must be a number greater than zero' },
          { status: 400 }
        );
      }
      updateFields.shares = parsedShares;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('account_portfolio_holdings')
      .update(updateFields)
      .eq('id', holdingId)
      .eq('account_id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This symbol already exists for the account' },
          { status: 400 }
        );
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
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
  { params }: { params: { id: string; holdingId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, holdingId } = await params;

    const { error } = await supabase
      .from('account_portfolio_holdings')
      .delete()
      .eq('id', holdingId)
      .eq('account_id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
