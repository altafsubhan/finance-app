import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';

const ALLOWED_ENTRY_TYPES = ['income', '401k', 'hsa'] as const;
type IncomeEntryType = (typeof ALLOWED_ENTRY_TYPES)[number];

function normalizeTags(input: unknown, legacyEntryType?: IncomeEntryType): string[] {
  const rawTags = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];

  const cleaned = rawTags
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (cleaned.length > 0) {
    return Array.from(new Set(cleaned));
  }

  if (legacyEntryType && legacyEntryType !== 'income') {
    return [legacyEntryType];
  }

  return ['income'];
}

function normalizeStockPayload(symbol: unknown, shares: unknown) {
  if (symbol === undefined && shares === undefined) {
    return { stock_symbol: null, stock_shares: null };
  }

  if (typeof symbol !== 'string' || !symbol.trim()) {
    throw new Error('Stock symbol is required when recording stock income');
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalizedSymbol)) {
    throw new Error('Stock symbol must be 1-15 chars using letters, numbers, dot, or dash');
  }

  const parsedShares = Number(shares);
  if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
    throw new Error('Stock shares must be a number greater than zero');
  }

  return {
    stock_symbol: normalizedSymbol,
    stock_shares: parsedShares,
  };
}

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
    const isSharedParam = request.nextUrl.searchParams.get('is_shared');

    let query = supabase
      .from('income_entries')
      .select('*, account:accounts(id, is_shared)')
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

    let filtered = data || [];
    if (isSharedParam !== null) {
      const wantShared = isSharedParam === 'true';
      filtered = filtered.filter((entry: any) => {
        const account = entry.account;
        return account ? account.is_shared === wantShared : false;
      });
    }

    return NextResponse.json(filtered);
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
    const { account_id, amount, received_date, source, notes, entry_type, tags, stock_symbol, stock_shares } = body;

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

    let stockPayload;
    try {
      stockPayload = normalizeStockPayload(stock_symbol, stock_shares);
    } catch (stockError: any) {
      return NextResponse.json({ error: stockError.message }, { status: 400 });
    }

    const normalizedTags = normalizeTags(tags, parsedEntryType);

    // RLS-aware lookup ensures the selected account is visible to this user.
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id,user_id,investment_portfolio_enabled')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found or not accessible' },
        { status: 400 }
      );
    }

    if (stockPayload.stock_symbol && !account.investment_portfolio_enabled) {
      return NextResponse.json(
        { error: 'Enable investment portfolio tracking on this account before adding stock income' },
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
        tags: normalizedTags,
        stock_symbol: stockPayload.stock_symbol,
        stock_shares: stockPayload.stock_shares,
      })
      .select()
      .single();

    if (error) throw error;

    if (stockPayload.stock_symbol && stockPayload.stock_shares && account.user_id === user.id) {
      const { data: existingHolding } = await supabase
        .from('account_portfolio_holdings')
        .select('id, shares')
        .eq('account_id', account_id)
        .eq('user_id', user.id)
        .eq('symbol', stockPayload.stock_symbol)
        .maybeSingle();

      if (existingHolding?.id) {
        const { error: updateHoldingError } = await supabase
          .from('account_portfolio_holdings')
          .update({ shares: Number(existingHolding.shares) + stockPayload.stock_shares })
          .eq('id', existingHolding.id)
          .eq('user_id', user.id);
        if (updateHoldingError) throw updateHoldingError;
      } else {
        const { error: insertHoldingError } = await supabase
          .from('account_portfolio_holdings')
          .insert({
            account_id,
            user_id: user.id,
            symbol: stockPayload.stock_symbol,
            shares: stockPayload.stock_shares,
          });
        if (insertHoldingError) throw insertHoldingError;
      }
    }

    const shouldAutoAdjustBalances =
      account?.user_id === user.id &&
      (await isIncomeAutoAdjustEnabledForUser(supabase, user.id));
    if (shouldAutoAdjustBalances) {
      await syncIncomeSnapshotsForAccount(supabase, account_id, user.id);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
