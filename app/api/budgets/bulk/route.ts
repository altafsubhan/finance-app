import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Apply a budget "going forward" without rewriting closed history.
 *
 * It writes explicit budget rows from a starting period through a future
 * horizon, so the dashboard uses the new amount for the current period and
 * every later one. Past periods are never touched, so historical months keep
 * whatever they had (an explicit row or the category default).
 *
 * Body:
 *   { category_id, amount,
 *     period?: 'month' | 'quarter' | 'year'   (default 'month'),
 *     from_year, from_value?,                  (from_value = start month 1-12 / quarter 1-4)
 *     through_year? }                          (default from_year + 10)
 *
 * Backwards compatible with the older "this year forward" call:
 *   { category_id, year, amount, from_month, to_month? }
 */
const DEFAULT_HORIZON_YEARS = 10;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // ── Legacy single-year monthly path (kept for the BudgetForm checkbox) ──
    if (body.from_month !== undefined && body.period === undefined && body.from_value === undefined) {
      const { category_id, year, amount, from_month, to_month } = body;
      if (!category_id || !year || amount === undefined || !from_month) {
        return NextResponse.json(
          { error: 'category_id, year, amount, and from_month are required' },
          { status: 400 }
        );
      }
      const start = Math.max(1, parseInt(from_month));
      const end = Math.min(12, to_month ? parseInt(to_month) : 12);
      if (end < start) {
        return NextResponse.json({ error: 'to_month must be >= from_month' }, { status: 400 });
      }
      const rows = [];
      for (let m = start; m <= end; m++) {
        rows.push({
          category_id, year: parseInt(year), period: 'month',
          period_value: m, amount: parseFloat(amount), user_id: user.id,
        });
      }
      const { data, error } = await supabase
        .from('budgets')
        .upsert(rows, { onConflict: 'category_id,year,period,period_value' })
        .select();
      if (error) throw error;
      return NextResponse.json({ applied: data?.length || 0 }, { status: 201 });
    }

    // ── Forward-across-future-years path ──
    const {
      category_id,
      amount,
      period = 'month',
      from_year,
      from_value,
      through_year,
    } = body;

    if (!category_id || amount === undefined || !from_year) {
      return NextResponse.json(
        { error: 'category_id, amount, and from_year are required' },
        { status: 400 }
      );
    }
    if (!['month', 'quarter', 'year'].includes(period)) {
      return NextResponse.json({ error: 'invalid period' }, { status: 400 });
    }

    const startYear = parseInt(from_year);
    const endYear = through_year ? parseInt(through_year) : startYear + DEFAULT_HORIZON_YEARS;
    if (endYear < startYear) {
      return NextResponse.json({ error: 'through_year must be >= from_year' }, { status: 400 });
    }

    const amt = parseFloat(amount);
    const maxValue = period === 'month' ? 12 : period === 'quarter' ? 4 : 1;
    const startValue = period === 'year' ? 1 : Math.min(maxValue, Math.max(1, parseInt(from_value ?? '1')));

    const rows: Array<Record<string, unknown>> = [];
    for (let y = startYear; y <= endYear; y++) {
      if (period === 'year') {
        rows.push({ category_id, year: y, period: 'year', period_value: null, amount: amt, user_id: user.id });
      } else {
        const first = y === startYear ? startValue : 1;
        for (let v = first; v <= maxValue; v++) {
          rows.push({ category_id, year: y, period, period_value: v, amount: amt, user_id: user.id });
        }
      }
    }

    // For year budgets the conflict target includes a NULL period_value, which
    // upsert can't dedupe reliably, so clear the span first then insert.
    if (period === 'year') {
      const { error: delErr } = await supabase
        .from('budgets')
        .delete()
        .eq('category_id', category_id)
        .eq('period', 'year')
        .gte('year', startYear)
        .lte('year', endYear);
      if (delErr) throw delErr;

      const { data, error } = await supabase.from('budgets').insert(rows).select();
      if (error) throw error;
      return NextResponse.json({ applied: data?.length || 0 }, { status: 201 });
    }

    const { data, error } = await supabase
      .from('budgets')
      .upsert(rows, { onConflict: 'category_id,year,period,period_value' })
      .select();
    if (error) throw error;

    return NextResponse.json({ applied: data?.length || 0 }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
