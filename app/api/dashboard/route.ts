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
    const yearNum = parseInt(year);

    // Get all categories (RLS handles shared access)
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (categoriesError) throw categoriesError;

    // Get budgets for the year (RLS handles shared access)
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*')
      .eq('year', yearNum);

    if (budgetsError) throw budgetsError;

    // Get all transactions for the year (RLS handles shared access)
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('year', yearNum);

    if (transactionsError) throw transactionsError;

    const normalizeCategoryName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

    // Keep dashboard totals aligned with the Transactions page "fixed vs variable" tracked monthly expenses.
    const FIXED_EXPENSES = new Set(
      ['rent', 'car - insurance', 'phone + wifi'].map(normalizeCategoryName)
    );
    const VARIABLE_EXPENSES = new Set(
      [
        'activities',
        'car - charging',
        'car - cleaning',
        'car - gas',
        'food- caafe',
        'food - eat out',
        'food - office',
        'grocery',
        'house items',
        'miscellaneous',
        'subscriptions',
        'utilities + electricity',
      ].map(normalizeCategoryName)
    );
    const IGNORED_EXPENSES = new Set(
      ['subi personal', 'mano personal', 'health expenses'].map(normalizeCategoryName)
    );

    const isTrackedMonthlyCategory = (categoryId: string) => {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return false;
      if (category.type !== 'monthly') return false;
      const normalized = normalizeCategoryName(category.name);
      if (IGNORED_EXPENSES.has(normalized)) return false;
      return FIXED_EXPENSES.has(normalized) || VARIABLE_EXPENSES.has(normalized);
    };

    const expenseAmount = (amount: any) => {
      const num = parseFloat(amount?.toString?.() ?? amount);
      if (Number.isNaN(num)) return 0;
      // Treat stored transaction amounts as absolute spend (charges are positive in this dataset)
      return Math.abs(num);
    };

    // Helper to get budget for a category and period
    const getBudgetForCategory = (
      categoryId: string,
      categoryType: 'monthly' | 'quarterly' | 'yearly',
      period: 'month' | 'quarter' | 'year',
      periodValue: number | null
    ): number => {
      const budgetPeriod = categoryType === 'monthly' ? 'month' : categoryType === 'quarterly' ? 'quarter' : 'year';
      
      if (period !== budgetPeriod) return 0; // Period type mismatch

      const matchingBudgets = budgets.filter(
        b => b.category_id === categoryId && b.period === budgetPeriod && b.year === yearNum
      );

      // Try period-specific budget first
      if (periodValue !== null) {
        const specific = matchingBudgets.find(b => b.period_value === periodValue);
        if (specific) return parseFloat(specific.amount.toString());
      }

      // Try general budget (no period_value)
      const general = matchingBudgets.find(b => b.period_value === null);
      if (general) return parseFloat(general.amount.toString());

      // Fall back to category default
      const category = categories.find(c => c.id === categoryId);
      return category?.default_budget ? parseFloat(category.default_budget.toString()) : 0;
    };

    // Calculate monthly summaries
    const monthlySummaries = Array.from({ length: 12 }, (_, monthIndex) => {
      const month = monthIndex + 1;
      const monthTransactions =
        transactions?.filter(
          t =>
            t.month === month &&
            t.category_id !== null &&
            isTrackedMonthlyCategory(t.category_id)
        ) || [];
      
      let totalBudget = 0;
      let totalActual = 0;

      categories.forEach(category => {
        if (category.type === 'monthly' && isTrackedMonthlyCategory(category.id)) {
          const budget = getBudgetForCategory(category.id, 'monthly', 'month', month);
          const actual = monthTransactions
            .filter(t => t.category_id === category.id)
            .reduce((sum, t) => sum + expenseAmount(t.amount), 0);
          
          totalBudget += budget;
          totalActual += actual;
        }
      });

      return {
        period: 'month',
        periodValue: month,
        budget: totalBudget,
        actual: totalActual,
        difference: totalBudget - totalActual,
      };
    });

    // Calculate quarterly summaries
    const quarterlySummaries = Array.from({ length: 4 }, (_, quarterIndex) => {
      const quarter = quarterIndex + 1;
      const quarterTransactions =
        transactions?.filter(t => t.quarter === quarter && t.category_id !== null) || [];
      
      let totalBudget = 0;
      let totalActual = 0;

      categories.forEach(category => {
        if (category.type === 'quarterly') {
          const budget = getBudgetForCategory(category.id, 'quarterly', 'quarter', quarter);
          const actual = quarterTransactions
            .filter(t => t.category_id === category.id)
            .reduce((sum, t) => sum + expenseAmount(t.amount), 0);
          
          totalBudget += budget;
          totalActual += actual;
        }
      });

      return {
        period: 'quarter',
        periodValue: quarter,
        budget: totalBudget,
        actual: totalActual,
        difference: totalBudget - totalActual,
      };
    });

    // Calculate annual summary
    const annualTransactions = (transactions || []).filter(t => t.category_id !== null);
    let annualBudget = 0;
    let annualActual = 0;

    categories.forEach(category => {
      if (category.type === 'yearly') {
        const budget = getBudgetForCategory(category.id, 'yearly', 'year', null);
        const actual = annualTransactions
          .filter(t => t.category_id === category.id)
          .reduce((sum, t) => sum + expenseAmount(t.amount), 0);
        
        annualBudget += budget;
        annualActual += actual;
      }
    });

    const annualSummary = {
      period: 'year',
      periodValue: null,
      budget: annualBudget,
      actual: annualActual,
      difference: annualBudget - annualActual,
    };

    // Calculate average monthly expense (run-rate)
    // Desired: current-month spending + (current-quarter spending ÷ 4) + (annual spending ÷ 12)
    const totalMonthly = monthlySummaries.reduce((sum, m) => sum + m.actual, 0);
    const totalQuarterly = quarterlySummaries.reduce((sum, q) => sum + q.actual, 0);
    const totalAnnual = annualActual;

    const now = new Date();
    const isCurrentYear = yearNum === now.getFullYear();
    const defaultMonth = now.getMonth() + 1;
    const defaultQuarter = Math.floor(now.getMonth() / 3) + 1;

    const lastNonZeroMonth = (() => {
      for (let i = monthlySummaries.length - 1; i >= 0; i--) {
        if (monthlySummaries[i].actual > 0) return monthlySummaries[i].periodValue;
      }
      return 1;
    })();
    const lastNonZeroQuarter = (() => {
      for (let i = quarterlySummaries.length - 1; i >= 0; i--) {
        if (quarterlySummaries[i].actual > 0) return quarterlySummaries[i].periodValue;
      }
      return 1;
    })();

    const currentMonth = isCurrentYear ? defaultMonth : lastNonZeroMonth;
    const currentQuarter = isCurrentYear ? defaultQuarter : lastNonZeroQuarter;

    const currentMonthActual =
      monthlySummaries.find(m => m.periodValue === currentMonth)?.actual ?? 0;
    const currentQuarterActual =
      quarterlySummaries.find(q => q.periodValue === currentQuarter)?.actual ?? 0;

    const averageMonthlyExpense =
      currentMonthActual + (currentQuarterActual / 4) + (totalAnnual / 12);

    // Calculate total expense for the year
    const totalYearExpense = totalMonthly + totalQuarterly + totalAnnual;

    return NextResponse.json({
      year: yearNum,
      monthlySummaries,
      quarterlySummaries,
      annualSummary,
      averageMonthlyExpense,
      totalYearExpense,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

