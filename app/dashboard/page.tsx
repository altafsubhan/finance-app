'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Budget, Category, Transaction, PaymentMethod } from '@/types/database';
import CategoryBreakdownModal from '@/components/CategoryBreakdownModal';
import MarkPaidModal from '@/components/MarkPaidModal';
import OutstandingTransactionsPopup from '@/components/OutstandingTransactionsPopup';

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
  const [scope, setScope] = useState<'shared' | 'personal'>('shared');
  const isShared = scope === 'shared';
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const [outstandingPopup, setOutstandingPopup] = useState<{
    isOpen: boolean;
    paymentMethod: string;
  }>({ isOpen: false, paymentMethod: '' });

  const [markingPaidFor, setMarkingPaidFor] = useState<PaymentMethod | null>(null);

  const [breakdownModal, setBreakdownModal] = useState<{
    isOpen: boolean;
    periodType: 'monthly' | 'quarterly' | 'yearly';
    periodValue: number | null;
    periodLabel: string;
  }>({ isOpen: false, periodType: 'monthly', periodValue: null, periodLabel: '' });

  const [monthlyGridExpanded, setMonthlyGridExpanded] = useState(false);
  const [quarterlyGridExpanded, setQuarterlyGridExpanded] = useState(false);

  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardRes, transactionsRes, categoriesRes, budgetsRes] = await Promise.all([
        fetch(`/api/dashboard?year=${selectedYear}&is_shared=${isShared}`, { credentials: 'include' }),
        fetch(`/api/transactions?year=${selectedYear}&is_shared=${isShared}`, { credentials: 'include' }),
        fetch(`/api/categories?is_shared=${isShared}`, { credentials: 'include' }),
        fetch(`/api/budgets?year=${selectedYear}`, { credentials: 'include' }),
      ]);

      if (dashboardRes.ok) setDashboardData(await dashboardRes.json());
      if (transactionsRes.ok) setTransactions(await transactionsRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (budgetsRes.ok) setBudgets(await budgetsRes.json());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, isShared]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const anyModalOpen = outstandingPopup.isOpen || !!markingPaidFor || breakdownModal.isOpen;
  useEffect(() => {
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [anyModalOpen]);

  // ── Derived data ──

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentMonthLabel = now.toLocaleString('default', { month: 'long' });
  const currentMonthSummary = dashboardData?.monthlySummaries?.[currentMonth - 1];

  const getCategoryType = useCallback((categoryId: string | null) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    return cat?.type || null;
  }, [categories]);

  const outstandingByPaymentMethod = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(t => t.paid_by === null && t.category_id !== null && getCategoryType(t.category_id) !== null)
      .forEach(t => {
        if (!result[t.payment_method]) result[t.payment_method] = 0;
        result[t.payment_method] += Math.abs(t.amount);
      });
    return result;
  }, [transactions, getCategoryType]);

  const totalOutstanding = useMemo(
    () => Object.values(outstandingByPaymentMethod).reduce((sum, v) => sum + v, 0),
    [outstandingByPaymentMethod],
  );

  const monthBudgetPercent =
    currentMonthSummary && currentMonthSummary.budget > 0
      ? (currentMonthSummary.actual / currentMonthSummary.budget) * 100
      : 0;

  // ── Helpers ──

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

  const getMonthName = (month: number) =>
    new Date(2000, month - 1).toLocaleString('default', { month: 'short' });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // ── Long-press handlers (outstanding rows) ──

  const cancelHoldTimer = () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const startHoldTimer = (pos: { x: number; y: number }, pm: string) => {
    touchStartPosRef.current = pos;
    cancelHoldTimer();
    touchHoldTimerRef.current = setTimeout(() => {
      setOutstandingPopup({ isOpen: true, paymentMethod: pm });
      touchHoldTimerRef.current = null;
    }, 500);
  };

  const handleTouchStart = (e: React.TouchEvent, pm: string) => {
    e.stopPropagation();
    if (e.touches.length > 0) startHoldTimer({ x: e.touches[0].clientX, y: e.touches[0].clientY }, pm);
  };
  const handleTouchEnd = (e: React.TouchEvent) => { e.stopPropagation(); cancelHoldTimer(); };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) cancelHoldTimer();
    }
  };
  const handleMouseDown = (e: React.MouseEvent, pm: string) => { e.stopPropagation(); startHoldTimer({ x: e.clientX, y: e.clientY }, pm); };
  const handleMouseUp = (e: React.MouseEvent) => { e.stopPropagation(); cancelHoldTimer(); };
  const handleMouseLeave = () => cancelHoldTimer();

  // ── Actions ──

  const handleMarkPaid = async (paymentMethod: PaymentMethod, accountId: string) => {
    const unpaid = transactions.filter(t =>
      t.payment_method === paymentMethod &&
      t.paid_by === null &&
      t.category_id !== null &&
      getCategoryType(t.category_id) !== null
    );
    if (unpaid.length === 0) throw new Error('No unpaid transactions');

    const res = await fetch('/api/transactions/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ transaction_ids: unpaid.map(t => t.id), updates: { paid_by: accountId } }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to mark as paid');
    }
    await loadData();
  };

  const handlePeriodClick = (
    periodType: 'monthly' | 'quarterly' | 'yearly',
    periodValue: number | null,
    periodLabel: string,
  ) => {
    setBreakdownModal({ isOpen: true, periodType, periodValue, periodLabel });
  };

  // ── Render ──

  if (loading) {
    return (
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto"><div className="text-center py-12">Loading...</div></div>
      </main>
    );
  }

  const budgetBarColor =
    monthBudgetPercent > 100 ? 'bg-red-500' : monthBudgetPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const budgetTextColor =
    monthBudgetPercent > 100 ? 'text-red-600' : monthBudgetPercent > 80 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-4xl font-bold">Dashboard</h1>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setScope('shared')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  isShared ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Shared
              </button>
              <button
                onClick={() => setScope('personal')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  !isShared ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Personal
              </button>
            </div>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* ── Key Metrics ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 sm:p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Spent</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(dashboardData?.totalYearExpense || 0)}
            </div>
            <div className="text-xs text-gray-400 mt-1">{selectedYear} year to date</div>
          </div>

          <div className="bg-white border rounded-lg p-4 sm:p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Monthly</div>
            <div className={`text-xl sm:text-2xl font-bold mt-1 ${isShared ? 'text-blue-600' : 'text-purple-600'}`}>
              {formatCurrency(dashboardData?.averageMonthlyExpense || 0)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Run-rate estimate</div>
          </div>

          <div className="bg-white border rounded-lg p-4 sm:p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {currentMonthLabel} Budget
            </div>
            <div className={`text-xl sm:text-2xl font-bold mt-1 ${budgetTextColor}`}>
              {currentMonthSummary && currentMonthSummary.budget > 0
                ? `${monthBudgetPercent.toFixed(0)}%`
                : '\u2014'}
            </div>
            {currentMonthSummary && currentMonthSummary.budget > 0 && (
              <>
                <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full ${budgetBarColor}`}
                    style={{ width: `${Math.min(monthBudgetPercent, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatCurrency(currentMonthSummary.actual)} of {formatCurrency(currentMonthSummary.budget)}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4 sm:p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</div>
            <div className={`text-xl sm:text-2xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
              {formatCurrency(totalOutstanding)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {Object.keys(outstandingByPaymentMethod).length} payment method{Object.keys(outstandingByPaymentMethod).length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* ── Outstanding Payments ── */}
        {Object.keys(outstandingByPaymentMethod).length > 0 && (
          <div className="bg-white border rounded-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Outstanding Payments</h2>
              <p className="text-xs text-gray-400 mt-0.5">Long-press a row to view transactions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 sm:px-6 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(outstandingByPaymentMethod)
                    .filter(([, amount]) => amount > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([method, amount]) => (
                      <tr
                        key={method}
                        className="hover:bg-gray-50 cursor-pointer select-none"
                        onTouchStart={(e) => handleTouchStart(e, method)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                        onMouseDown={(e) => handleMouseDown(e, method)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                      >
                        <td className="px-4 sm:px-6 py-3 text-sm font-medium text-gray-900">{method}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-semibold text-rose-600">{formatCurrency(amount)}</td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMarkingPaidFor(method as PaymentMethod); }}
                            className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
                          >
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 sm:px-6 py-3 text-sm font-semibold text-gray-900">Total</td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-rose-600">{formatCurrency(totalOutstanding)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Monthly Overview ── */}
        {dashboardData && (
          <div className="bg-white border rounded-lg">
            <button
              onClick={() => setMonthlyGridExpanded(!monthlyGridExpanded)}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg"
            >
              <h2 className="text-lg font-semibold text-gray-900">Monthly Overview</h2>
              <span className="text-gray-500">{monthlyGridExpanded ? '\u2212' : '+'}</span>
            </button>
            {monthlyGridExpanded && (
              <div className="p-4 sm:p-6 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {dashboardData.monthlySummaries.map((summary, index) => {
                    const month = index + 1;
                    const isOverBudget = summary.actual > summary.budget && summary.budget > 0;
                    return (
                      <button
                        key={month}
                        onClick={() => handlePeriodClick('monthly', month, getMonthName(month))}
                        className={`text-left p-3 sm:p-4 border rounded-lg hover:shadow-md transition-shadow ${
                          isOverBudget ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{getMonthName(month)}</div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{formatCurrency(summary.actual)}</div>
                        {summary.budget > 0 && (
                          <div className="text-xs text-gray-500">of {formatCurrency(summary.budget)}</div>
                        )}
                        {summary.budget > 0 && (
                          <div className={`text-xs font-medium mt-1 ${summary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.difference >= 0 ? '+' : ''}{formatCurrency(summary.difference)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quarterly Grid ── */}
        {dashboardData && (
          <div className="bg-white border rounded-lg">
            <button
              onClick={() => setQuarterlyGridExpanded(!quarterlyGridExpanded)}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg"
            >
              <h2 className="text-lg font-semibold text-gray-900">Quarterly Overview</h2>
              <span className="text-gray-500">{quarterlyGridExpanded ? '\u2212' : '+'}</span>
            </button>
            {quarterlyGridExpanded && (
              <div className="p-4 sm:p-6 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {dashboardData.quarterlySummaries.map((summary) => {
                    const isOverBudget = summary.actual > summary.budget && summary.budget > 0;
                    return (
                      <button
                        key={summary.periodValue}
                        onClick={() => handlePeriodClick('quarterly', summary.periodValue, `Q${summary.periodValue}`)}
                        className={`text-left p-3 sm:p-4 border rounded-lg hover:shadow-md transition-shadow ${
                          isOverBudget ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Q{summary.periodValue}</div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{formatCurrency(summary.actual)}</div>
                        {summary.budget > 0 && (
                          <div className="text-xs text-gray-500">of {formatCurrency(summary.budget)}</div>
                        )}
                        {summary.budget > 0 && (
                          <div className={`text-xs font-medium mt-1 ${summary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.difference >= 0 ? '+' : ''}{formatCurrency(summary.difference)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Annual Summary ── */}
        {dashboardData && (
          <div className="bg-white border rounded-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Annual Summary</h2>
            </div>
            <div className="p-4 sm:p-6">
              <button
                onClick={() => handlePeriodClick('yearly', null, `${selectedYear}`)}
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
                      <div className={`text-xl sm:text-2xl font-bold ${
                        dashboardData.annualSummary.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dashboardData.annualSummary.difference >= 0 ? '+' : ''}
                        {formatCurrency(dashboardData.annualSummary.difference)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Remaining</div>
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Outstanding Transactions Popup ── */}
      {outstandingPopup.isOpen && (
        <OutstandingTransactionsPopup
          paymentMethod={outstandingPopup.paymentMethod}
          transactions={transactions}
          categories={categories}
          onClose={() => setOutstandingPopup({ isOpen: false, paymentMethod: '' })}
          onMarkPaid={() => {
            const pm = outstandingPopup.paymentMethod;
            setOutstandingPopup({ isOpen: false, paymentMethod: '' });
            setMarkingPaidFor(pm as PaymentMethod);
          }}
        />
      )}

      {/* ── Mark as Paid Modal ── */}
      {markingPaidFor && (
        <MarkPaidModal
          paymentMethod={markingPaidFor}
          onClose={() => setMarkingPaidFor(null)}
          onConfirm={async (accountId: string) => {
            await handleMarkPaid(markingPaidFor, accountId);
          }}
        />
      )}

      {/* ── Category Breakdown Modal ── */}
      <CategoryBreakdownModal
        isOpen={breakdownModal.isOpen}
        onClose={() => setBreakdownModal({ ...breakdownModal, isOpen: false })}
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
