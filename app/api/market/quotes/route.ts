import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MarketQuote {
  price: number | null;
  change_percent: number | null;
  currency: string | null;
  as_of: string | null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9.-]{1,15}$/.test(symbol);
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

    const symbolsParam = request.nextUrl.searchParams.get('symbols') || '';
    const requestedSymbols = symbolsParam
      .split(',')
      .map((value) => normalizeSymbol(value))
      .filter(Boolean);
    const uniqueSymbols = Array.from(new Set(requestedSymbols));

    if (uniqueSymbols.length === 0) {
      return NextResponse.json({ error: 'At least one symbol is required' }, { status: 400 });
    }
    if (uniqueSymbols.length > 25) {
      return NextResponse.json(
        { error: 'A maximum of 25 symbols is supported per request' },
        { status: 400 }
      );
    }
    if (!uniqueSymbols.every(isValidSymbol)) {
      return NextResponse.json(
        { error: 'Symbols must be 1-15 chars using letters, numbers, dot, or dash' },
        { status: 400 }
      );
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      uniqueSymbols.join(',')
    )}`;

    const upstreamResponse = await fetch(yahooUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'finance-app/1.0',
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch market data' },
        { status: upstreamResponse.status }
      );
    }

    const payload = await upstreamResponse.json();
    const results = payload?.quoteResponse?.result ?? [];

    const quotes: Record<string, MarketQuote> = {};
    uniqueSymbols.forEach((symbol) => {
      quotes[symbol] = {
        price: null,
        change_percent: null,
        currency: null,
        as_of: null,
      };
    });

    results.forEach((quote: any) => {
      const symbol = normalizeSymbol(String(quote?.symbol || ''));
      if (!quotes[symbol]) return;

      const price =
        typeof quote?.regularMarketPrice === 'number'
          ? quote.regularMarketPrice
          : null;
      const changePercent =
        typeof quote?.regularMarketChangePercent === 'number'
          ? quote.regularMarketChangePercent
          : null;
      const asOf =
        typeof quote?.regularMarketTime === 'number'
          ? new Date(quote.regularMarketTime * 1000).toISOString()
          : null;

      quotes[symbol] = {
        price,
        change_percent: changePercent,
        currency: quote?.currency || null,
        as_of: asOf,
      };
    });

    return NextResponse.json({
      quotes,
      fetched_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
