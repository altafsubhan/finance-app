'use client';

import { useMemo, useState } from 'react';
import { Budget, Category, Transaction } from '@/types/database';

type Period = 'month' | 'quarter' | 'year';
type ExpenseGroup = 'fixed' | 'variable';

interface BudgetVsSpendingPanelProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  period: Period;
  year: number;
  periodValue: number | null;
  periodLabel: string;
  enableGroupToggle?: boolean;
  showPeriodHint?: boolean;
  defaultExpanded?: boolean;
}

const normalizeCategoryName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

const getBudgetForCategory = (
  category: Category,
  budgets: Budget[],
  period: Period,
  year: number,
  periodValue: number | null
) => {
  const matchingBudgets = budgets.filter(
    budget =>
      budget.year === year &&
      budget.category_id === category.id &&
      budget.period === period
  );

  if (period !== 'year' && periodValue !== null) {
    const periodSpecific = matchingBudgets.find(budget => budget.period_value === periodValue);
    if (periodSpecific) return periodSpecific.amount;
  }

  const allPeriods = matchingBudgets.find(budget => budget.period_value === null);
  if (allPeriods) return allPeriods.amount;

  return category.default_budget ?? 0;
};

const getCategoryTypeForPeriod = (period: Period) => {
  if (period === 'month') return 'monthly';
  if (period === 'quarter') return 'quarterly';
  return 'yearly';
};

export default function BudgetVsSpendingPanel({
  transactions,
  categories,
  budgets,
  period,
  year,
  periodValue,
  periodLabel,
  enableGroupToggle = false,
  showPeriodHint = false,
  defaultExpanded = true,
}: BudgetVsSpendingPanelProps) {
  const [activeGroup, setActiveGroup] = useState<ExpenseGroup>('variable');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { rows, totals } = useMemo(() => {
    const categoryType = getCategoryTypeForPeriod(period);
    const periodCategories = categories.filter(category => category.type === categoryType);
    const categoryMap = new Map(periodCategories.map(category => [category.id, category]));

    const spendByCategory = transactions.reduce((acc, transaction) => {
      if (!transaction.category_id) return acc;
      if (transaction.year !== year) return acc;
      if (period === 'month' && transaction.month !== periodValue) return acc;
      if (period === 'quarter' && transaction.quarter !== periodValue) return acc;

      const category = categoryMap.get(transaction.category_id);
      if (!category) return acc;

      const normalized = normalizeCategoryName(category.name);
      if (IGNORED_EXPENSES.has(normalized)) return acc;
      if (enableGroupToggle) {
        if (!FIXED_EXPENSES.has(normalized) && !VARIABLE_EXPENSES.has(normalized)) return acc;
      }

      acc.set(
        transaction.category_id,
        (acc.get(transaction.category_id) ?? 0) + Math.abs(transaction.amount)
      );
      return acc;
    }, new Map<string, number>());

    const rows = periodCategories
      .filter(category => {
        const normalized = normalizeCategoryName(category.name);
        if (IGNORED_EXPENSES.has(normalized)) return false;
        if (!enableGroupToggle) return true;
        if (!FIXED_EXPENSES.has(normalized) && !VARIABLE_EXPENSES.has(normalized)) return false;
        if (activeGroup === 'fixed') return FIXED_EXPENSES.has(normalized);
        return VARIABLE_EXPENSES.has(normalized);
      })
      .map(category => {
        const spent = spendByCategory.get(category.id) ?? 0;
        const budget = getBudgetForCategory(category, budgets, period, year, periodValue);
        const remaining = budget - spent;
        const percent = budget > 0 ? (spent / budget) * 100 : 0;
        const isOverBudget = budget > 0 && spent > budget;

        return {
          id: category.id,
          name: category.name,
          spent,
          budget,
          remaining,
          percent,
          isOverBudget,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const totals = rows.reduce(
      (acc, row) => ({
        spent: acc.spent + row.spent,
        budget: acc.budget + row.budget,
      }),
      { spent: 0, budget: 0 }
    );

    return {
      rows,
      totals: {
        ...totals,
        remaining: totals.budget - totals.spent,
        percent: totals.budget > 0 ? (totals.spent / totals.budget) * 100 : 0,
      },
    };
  }, [activeGroup, budgets, categories, enableGroupToggle, period, periodValue, transactions, year]);

  const title =
    period === 'month'
      ? 'Monthly Budget vs Spending'
      : period === 'quarter'
      ? 'Quarterly Budget vs Spending'
      : 'Annual Budget vs Spending';

  return (
    <div className="bg-gray-50 border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 rounded-t-lg"
      >
        <div>
          <div className="font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">
            {periodLabel} {year}
            {showPeriodHint ? ' (select in filters to change)' : ''}
          </div>
        </div>
        <span className="text-gray-500 text-sm">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {enableGroupToggle && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup('variable')}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  activeGroup === 'variable'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                Variable
              </button>
              <button
                type="button"
                onClick={() => setActiveGroup('fixed')}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  activeGroup === 'fixed'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                Fixed
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border rounded-lg p-3">
              <div className="text-xs text-gray-500">Budget</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(totals.budget)}</div>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <div className="text-xs text-gray-500">Spent</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(totals.spent)}</div>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <div className="text-xs text-gray-500">Remaining</div>
              <div className={`text-lg font-semibold ${totals.remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(totals.remaining)}
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-sm text-gray-500">No categories found for this view.</div>
          ) : (
            <div className="space-y-3">
              {rows.map(row => (
                <div key={row.id} className="bg-white border rounded-lg p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatCurrency(row.spent)} / {formatCurrency(row.budget)}
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${row.isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(row.percent, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {row.budget > 0 ? (
                      <>
                        <span>{row.percent.toFixed(0)}% of budget</span>
                        <span>·</span>
                        <span className={row.remaining < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(row.remaining)} remaining
                        </span>
                      </>
                    ) : (
                      <span>No budget set</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
