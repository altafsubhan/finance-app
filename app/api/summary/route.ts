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
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const period = searchParams.get('period') || 'month'; // month, quarter, year
    const periodValue = searchParams.get('period_value'); // 1-12 for month, 1-4 for quarter

    const yearNum = parseInt(year);

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (categoriesError) throw categoriesError;

    // Get budgets for the year
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', yearNum);

    if (budgetsError) throw budgetsError;

    // Get transactions for the year using year field
    let transactionsQuery = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', yearNum);

    // Filter by period if specified
    if (period === 'month' && periodValue) {
      const monthNum = parseInt(periodValue);
      transactionsQuery = transactionsQuery.eq('month', monthNum);
    } else if (period === 'quarter' && periodValue) {
      const quarterNum = parseInt(periodValue);
      transactionsQuery = transactionsQuery.eq('quarter', quarterNum);
    }

    const { data: transactions, error: transactionsError } = await transactionsQuery;

    if (transactionsError) throw transactionsError;

    // Calculate summary for each category
    const summary = categories.map((category) => {
      // Find matching budget
      let budget = budgets.find(
        (b) =>
          b.category_id === category.id &&
          b.period === (category.type === 'monthly' ? 'month' : category.type === 'quarterly' ? 'quarter' : 'year') &&
          (!periodValue || b.period_value === parseInt(periodValue) || !b.period_value)
      );

      // If no specific budget found, try to find a general one (no period_value)
      if (!budget) {
        budget = budgets.find(
          (b) =>
            b.category_id === category.id &&
            b.period === (category.type === 'monthly' ? 'month' : category.type === 'quarterly' ? 'quarter' : 'year') &&
            !b.period_value
        );
      }

      // Calculate actual spending
      const categoryTransactions = transactions?.filter(
        (t) => t.category_id === category.id
      ) || [];

      const actual = categoryTransactions.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      );

      const budgetAmount = budget ? parseFloat(budget.amount.toString()) : (category.default_budget ? parseFloat(category.default_budget.toString()) : 0);
      const difference = budgetAmount - actual;

      return {
        category_id: category.id,
        category_name: category.name,
        category_type: category.type,
        budget: budgetAmount,
        actual,
        difference,
        transaction_count: categoryTransactions.length,
      };
    });

    // Calculate totals
    const totals = {
      budget: summary.reduce((sum, s) => sum + s.budget, 0),
      actual: summary.reduce((sum, s) => sum + s.actual, 0),
      difference: summary.reduce((sum, s) => sum + s.difference, 0),
    };

    return NextResponse.json({
      year: yearNum,
      period,
      period_value: periodValue ? parseInt(periodValue) : null,
      summary,
      totals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

