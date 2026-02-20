'use client';

import { useState, useMemo, useCallback } from 'react';
import { Transaction, Category, PaymentMethod } from '@/types/database';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface PaymentsMadeSummaryProps {
  transactions: Transaction[];
  categories: Category[];
  categoryTypeFilter?: 'monthly' | 'quarterly' | 'yearly' | '';
  defaultExpanded?: boolean;
}

export default function PaymentsMadeSummary({ transactions, categories, categoryTypeFilter = '', defaultExpanded = true }: PaymentsMadeSummaryProps) {
  const { paymentMethods } = usePaymentMethods();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const getCategoryType = useCallback((categoryId: string | null): 'monthly' | 'quarterly' | 'yearly' | null => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.type || null;
  }, [categories]);

  const paymentsByPaymentMethod = useMemo(() => {
    const result: Record<string, { total: number; paidBy: Record<string, number> }> = {};

    let paidTransactions = transactions.filter(t => t.paid_by !== null && t.category_id !== null);

    if (categoryTypeFilter) {
      paidTransactions = paidTransactions.filter(t => {
        const categoryType = getCategoryType(t.category_id);
        return categoryType === categoryTypeFilter;
      });
    }

    paidTransactions.forEach(transaction => {
      const pm = transaction.payment_method;
      if (!result[pm]) result[pm] = { total: 0, paidBy: {} };
      const amount = Math.abs(transaction.amount);
      result[pm].total += amount;
      const payer = transaction.paid_by || 'unknown';
      result[pm].paidBy[payer] = (result[pm].paidBy[payer] || 0) + amount;
    });

    return result;
  }, [transactions, categoryTypeFilter, getCategoryType]);

  const displayData = useMemo(() => {
    return selectedPaymentMethod
      ? { [selectedPaymentMethod]: paymentsByPaymentMethod[selectedPaymentMethod] || { total: 0, paidBy: {} } }
      : paymentsByPaymentMethod;
  }, [selectedPaymentMethod, paymentsByPaymentMethod]);

  const totalPaid = useMemo(() => {
    return Object.values(displayData).reduce((sum, v) => sum + v.total, 0);
  }, [displayData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-gray-50 border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 rounded-t-lg"
      >
        <span className="font-medium text-gray-900">Payments Made by Payment Method</span>
        <span className="text-gray-500 text-sm">{isExpanded ? '−' : '+'}</span>
      </button>
      {isExpanded && (
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="payments-payment-method" className="block text-sm font-medium mb-2 text-gray-700">
              Filter by Payment Method
            </label>
            <select
              id="payments-payment-method"
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.name}>{method.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <div className="text-sm font-medium text-green-900 mb-1">Total Payments Made</div>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(totalPaid)}</div>
          </div>

          {Object.keys(displayData).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Breakdown by Payment Method:
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Payment Method</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Paid</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Paid By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(displayData)
                      .filter(([_, data]) => data.total > 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([method, data]) => (
                        <tr key={method} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{method}</td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-green-700">{formatCurrency(data.total)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {Object.entries(data.paidBy).map(([payer, amt]) => (
                              <span key={payer} className="mr-2">
                                {payer === 'joint' ? 'Joint' : payer}: {formatCurrency(amt)}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
