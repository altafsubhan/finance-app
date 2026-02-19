import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MarketQuote {
  price: number | null;
  change_percent: number | null;
  currency: string | null;
  as_of: string | null;
}

const CASH_HOLDING_SYMBOL = 'CASH';

const REQUEST_HEADERS = {
  'User-Agent': 'finance-app/1.0',
  Accept: 'application/json,text/plain,*/*',
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9.-]{1,15}$/.test(symbol);
}

function emptyQuote(): MarketQuote {
  return {
    price: null,
    change_percent: null,
    currency: null,
    as_of: null,
  };
}

function getMissingSymbols(quotes: Record<string, MarketQuote>): string[] {
  return Object.entries(quotes)
    .filter(([, quote]) => quote.price === null)
    .map(([symbol]) => symbol);
}

function parseYahooQuoteResult(raw: any): MarketQuote {
  const price =
    typeof raw?.regularMarketPrice === 'number' ? raw.regularMarketPrice : null;
  const changePercent =
    typeof raw?.regularMarketChangePercent === 'number'
      ? raw.regularMarketChangePercent
      : null;
  const asOf =
    typeof raw?.regularMarketTime === 'number'
      ? new Date(raw.regularMarketTime * 1000).toISOString()
      : null;

  return {
    price,
    change_percent: changePercent,
    currency: raw?.currency || null,
    as_of: asOf,
  };
}

function parseYahooChartResult(raw: any): MarketQuote {
  const result = raw?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const quoteData = result?.indicators?.quote?.[0] ?? {};
  const closeSeries = Array.isArray(quoteData?.close) ? quoteData.close : [];
  const lastClose = [...closeSeries].reverse().find((value) => Number.isFinite(value));

  const marketPrice =
    typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
  const resolvedPrice =
    marketPrice ?? (typeof lastClose === 'number' ? Number(lastClose) : null);

  let changePercent: number | null = null;
  if (typeof meta?.regularMarketChangePercent === 'number') {
    changePercent = meta.regularMarketChangePercent;
  } else if (
    resolvedPrice !== null &&
    typeof meta?.chartPreviousClose === 'number' &&
    meta.chartPreviousClose !== 0
  ) {
    changePercent = ((resolvedPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
  }

  const asOf =
    typeof meta?.regularMarketTime === 'number'
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null;

  return {
    price: resolvedPrice,
    change_percent: changePercent,
    currency: meta?.currency || null,
    as_of: asOf,
  };
}

function parseStooqCsvQuote(csvText: string): MarketQuote {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return emptyQuote();

  const values = lines[1].split(',');
  if (values.length < 7) return emptyQuote();

  const dateValue = values[1];
  const timeValue = values[2];
  const closeValue = values[6];
  if (!closeValue || closeValue === 'N/D') return emptyQuote();

  const parsedPrice = Number(closeValue);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return emptyQuote();

  let asOf: string | null = null;
  if (dateValue && timeValue) {
    const iso = new Date(`${dateValue}T${timeValue}Z`);
    if (!Number.isNaN(iso.getTime())) {
      asOf = iso.toISOString();
    }
  }

  return {
    price: parsedPrice,
    change_percent: null,
    currency: 'USD',
    as_of: asOf,
  };
}

async function fetchYahooBatchQuotes(symbols: string[]) {
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(',')
  )}`;
  const res = await fetch(yahooUrl, {
    cache: 'no-store',
    headers: REQUEST_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Yahoo batch endpoint returned ${res.status}`);
  }
  const payload = await res.json();
  return payload?.quoteResponse?.result ?? [];
}

async function fetchYahooChartQuote(symbol: string): Promise<MarketQuote> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=5d`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: REQUEST_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Yahoo chart endpoint returned ${res.status}`);
  }
  const payload = await res.json();
  return parseYahooChartResult(payload);
}

async function fetchStooqQuote(symbol: string): Promise<MarketQuote> {
  const stooqSymbol = `${symbol.toLowerCase().replace(/\./g, '-')}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: REQUEST_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Stooq endpoint returned ${res.status}`);
  }
  const csv = await res.text();
  return parseStooqCsvQuote(csv);
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

    const quotes: Record<string, MarketQuote> = {};
    uniqueSymbols.forEach((symbol) => {
      if (symbol === CASH_HOLDING_SYMBOL) {
        quotes[symbol] = {
          price: 1,
          change_percent: null,
          currency: 'USD',
          as_of: new Date().toISOString(),
        };
        return;
      }
      quotes[symbol] = emptyQuote();
    });

    const providerErrors: string[] = [];
    const fetchSymbols = uniqueSymbols.filter((symbol) => symbol !== CASH_HOLDING_SYMBOL);

    // Primary provider: Yahoo batch quote endpoint.
    if (fetchSymbols.length > 0) {
      try {
        const results = await fetchYahooBatchQuotes(fetchSymbols);
        results.forEach((quote: any) => {
          const symbol = normalizeSymbol(String(quote?.symbol || ''));
          if (!quotes[symbol]) return;
          quotes[symbol] = parseYahooQuoteResult(quote);
        });
      } catch (error: any) {
        providerErrors.push(error?.message || 'Yahoo batch quote fetch failed');
      }
    }

    // Fallback 1: Yahoo chart endpoint per missing symbol.
    const missingAfterBatch = getMissingSymbols(quotes);
    if (missingAfterBatch.length > 0) {
      const chartResults = await Promise.all(
        missingAfterBatch.map(async (symbol) => {
          try {
            const quote = await fetchYahooChartQuote(symbol);
            return { symbol, quote };
          } catch (error: any) {
            providerErrors.push(
              `Yahoo chart fallback failed for ${symbol}: ${
                error?.message || 'unknown error'
              }`
            );
            return { symbol, quote: emptyQuote() };
          }
        })
      );
      chartResults.forEach(({ symbol, quote }) => {
        if (quote.price !== null) {
          quotes[symbol] = quote;
        }
      });
    }

    // Fallback 2: Stooq CSV quote per remaining missing symbol.
    const missingAfterYahoo = getMissingSymbols(quotes);
    if (missingAfterYahoo.length > 0) {
      const stooqResults = await Promise.all(
        missingAfterYahoo.map(async (symbol) => {
          try {
            const quote = await fetchStooqQuote(symbol);
            return { symbol, quote };
          } catch (error: any) {
            providerErrors.push(
              `Stooq fallback failed for ${symbol}: ${
                error?.message || 'unknown error'
              }`
            );
            return { symbol, quote: emptyQuote() };
          }
        })
      );
      stooqResults.forEach(({ symbol, quote }) => {
        if (quote.price !== null) {
          quotes[symbol] = quote;
        }
      });
    }

    return NextResponse.json({
      quotes,
      unresolved_symbols: getMissingSymbols(quotes),
      provider_errors: Array.from(new Set(providerErrors)),
      fetched_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
