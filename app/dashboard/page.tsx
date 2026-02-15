'use client';

import { useState, useEffect, useCallback } from 'react';
import { Budget, Category, Transaction } from '@/types/database';
import CategoryBreakdownModal from '@/components/CategoryBreakdownModal';

interface PeriodSummary {
  period: 'month' | 'quarter' | 'year';
  periodValue: number | null;
  budget: number;
  actual: number;
  difference: number;
}

interface DashboardData {
  year: number;
  monthlySummaries: PeriodSummary[];
  quarterlySummaries: PeriodSummary[];
  annualSummary: PeriodSummary;
  averageMonthlyExpense: number;
  totalYearExpense: number;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [breakdownModal, setBreakdownModal] = useState<{
    isOpen: boolean;
    periodType: 'monthly' | 'quarterly' | 'yearly';
    periodValue: number | null;
    periodLabel: string;
  }>({
    isOpen: false,
    periodType: 'monthly',
    periodValue: null,
    periodLabel: '',
  });

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load dashboard summaries
      const dashboardRes = await fetch(`/api/dashboard?year=${selectedYear}`, {
        credentials: 'include',
      });
      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setDashboardData(data);
      }

      // Load transactions for breakdown modal
      const transactionsRes = await fetch(`/api/transactions?year=${selectedYear}`, {
        credentials: 'include',
      });
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }

      // Load categories
      const categoriesRes = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      // Load budgets
      const budgetsRes = await fetch(`/api/budgets?year=${selectedYear}`, {
        credentials: 'include',
      });
      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handlePeriodClick = (
    periodType: 'monthly' | 'quarterly' | 'yearly',
    periodValue: number | null,
    periodLabel: string
  ) => {
    setBreakdownModal({
      isOpen: true,
      periodType,
      periodValue,
      periodLabel,
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString('default', { month: 'short' });
  };

  const getQuarterLabel = (quarter: number) => {
    return `Q${quarter}`;
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  if (!dashboardData) {
    return (
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-gray-500">No data available</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Shared household expenses (fixed + variable categories only)
            </p>
          </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Total Shared Expense ({selectedYear})
            </h3>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatCurrency(dashboardData.totalYearExpense)}
            </p>
          </div>

          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Average Shared Monthly Expense
            </h3>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">
              {formatCurrency(dashboardData.averageMonthlyExpense)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Monthly + (Quarterly ÷ 4) + (Annual ÷ 12)
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-lg">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Monthly Shared Expenses
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {dashboardData.monthlySummaries.map((summary, index) => {
                const month = index + 1;
                const isOverBudget = summary.actual > summary.budget && summary.budget > 0;
                return (
                  <button
                    key={month}
                    onClick={() =>
                      handlePeriodClick(
                        'monthly',
                        month,
                        getMonthName(month)
                      )
                    }
                    className={`text-left p-3 sm:p-4 border rounded-lg hover:shadow-md transition-shadow ${
                      isOverBudget ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">
                      {getMonthName(month)}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                      {formatCurrency(summary.actual)}
                    </div>
                    {summary.budget > 0 && (
                      <div className="text-xs text-gray-500">
                        of {formatCurrency(summary.budget)}
                      </div>
                    )}
                    {summary.budget > 0 && (
                      <div
                        className={`text-xs font-medium mt-1 ${
                          summary.difference >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {summary.difference >= 0 ? '+' : ''}
                        {formatCurrency(summary.difference)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Quarterly Shared Expenses
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {dashboardData.quarterlySummaries.map((summary) => {
                const isOverBudget = summary.actual > summary.budget && summary.budget > 0;
                return (
                  <button
                    key={summary.periodValue}
                    onClick={() =>
                      handlePeriodClick(
                        'quarterly',
                        summary.periodValue,
                        getQuarterLabel(summary.periodValue!)
                      )
                    }
                    className={`text-left p-3 sm:p-4 border rounded-lg hover:shadow-md transition-shadow ${
                      isOverBudget ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">
                      {getQuarterLabel(summary.periodValue!)}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                      {formatCurrency(summary.actual)}
                    </div>
                    {summary.budget > 0 && (
                      <div className="text-xs text-gray-500">
                        of {formatCurrency(summary.budget)}
            </div>
                    )}
                    {summary.budget > 0 && (
                      <div
                        className={`text-xs font-medium mt-1 ${
                          summary.difference >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {summary.difference >= 0 ? '+' : ''}
                        {formatCurrency(summary.difference)}
            </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Annual Shared Expenses
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <button
              onClick={() =>
                handlePeriodClick('yearly', null, `${selectedYear}`)
              }
              className={`w-full text-left p-4 sm:p-6 border rounded-lg hover:shadow-md transition-shadow ${
                dashboardData.annualSummary.actual > dashboardData.annualSummary.budget &&
                dashboardData.annualSummary.budget > 0
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Year {selectedYear}</div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.annualSummary.actual)}
                </div>
                  {dashboardData.annualSummary.budget > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      of {formatCurrency(dashboardData.annualSummary.budget)}
            </div>
          )}
                </div>
                {dashboardData.annualSummary.budget > 0 && (
                  <div className="text-right">
                    <div
                      className={`text-xl sm:text-2xl font-bold ${
                        dashboardData.annualSummary.difference >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {dashboardData.annualSummary.difference >= 0 ? '+' : ''}
                      {formatCurrency(dashboardData.annualSummary.difference)}
              </div>
                    <div className="text-sm text-gray-500 mt-1">Difference</div>
            </div>
          )}
              </div>
            </button>
            </div>
        </div>
      </div>

      {/* Category Breakdown Modal */}
      <CategoryBreakdownModal
        isOpen={breakdownModal.isOpen}
        onClose={() =>
          setBreakdownModal({ ...breakdownModal, isOpen: false })
        }
        transactions={transactions}
        categories={categories}
        budgets={budgets}
        year={selectedYear}
        periodType={breakdownModal.periodType}
        periodValue={breakdownModal.periodValue}
        periodLabel={breakdownModal.periodLabel}
      />
    </main>
  );
}
