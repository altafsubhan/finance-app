'use client';

import { useState, useMemo } from 'react';
import { Transaction, Category, PaymentMethod } from '@/types/database';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface PaymentsMadeSummaryProps {
  transactions: Transaction[];
  categories: Category[];
}

interface PaymentsBreakdown {
  joint: number;
  subi: number;
  mano: number;
  total: number;
}

export default function PaymentsMadeSummary({ transactions, categories }: PaymentsMadeSummaryProps) {
  const { paymentMethods } = usePaymentMethods();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Get category names for personal identification
  const subiPersonalCategoryName = categories.find(c => 
    c.name.toLowerCase().includes('subi') && c.name.toLowerCase().includes('personal')
  )?.name || 'Subi Personal';
  
  const manoPersonalCategoryName = categories.find(c => 
    c.name.toLowerCase().includes('mano') && c.name.toLowerCase().includes('personal')
  )?.name || 'Mano Personal';

  // Calculate payments made by payment method
  const paymentsByPaymentMethod = useMemo(() => {
    const result: Record<string, PaymentsBreakdown> = {};

    // Filter to only paid transactions (paid_by is not null) and ignore uncategorized transactions
    const paidTransactions = transactions.filter(t => t.paid_by !== null && t.category_id !== null);

    paidTransactions.forEach(transaction => {
      const paymentMethod = transaction.payment_method;
      if (!result[paymentMethod]) {
        result[paymentMethod] = { joint: 0, subi: 0, mano: 0, total: 0 };
      }

      const category = categories.find(c => c.id === transaction.category_id);
      // Skip if category not found (shouldn't happen since we filter for category_id !== null, but safety check)
      if (!category) return;
      
      const categoryName = category.name;
      const amount = Math.abs(transaction.amount);

      // Categorize based on category name
      if (categoryName.toLowerCase() === subiPersonalCategoryName.toLowerCase()) {
        result[paymentMethod].subi += amount;
      } else if (categoryName.toLowerCase() === manoPersonalCategoryName.toLowerCase()) {
        result[paymentMethod].mano += amount;
      } else {
        result[paymentMethod].joint += amount;
      }
      
      result[paymentMethod].total += amount;
    });

    return result;
  }, [transactions, categories, subiPersonalCategoryName, manoPersonalCategoryName]);

  // Get the selected payment method breakdown or all payment methods
  const displayData = useMemo(() => {
    return selectedPaymentMethod
      ? { [selectedPaymentMethod]: paymentsByPaymentMethod[selectedPaymentMethod] || { joint: 0, subi: 0, mano: 0, total: 0 } }
      : paymentsByPaymentMethod;
  }, [selectedPaymentMethod, paymentsByPaymentMethod]);

  // Calculate totals across all displayed payment methods
  const totals = useMemo(() => {
    return Object.values(displayData).reduce(
      (acc, breakdown) => ({
        joint: acc.joint + breakdown.joint,
        subi: acc.subi + breakdown.subi,
        mano: acc.mano + breakdown.mano,
        total: acc.total + breakdown.total,
      }),
      { joint: 0, subi: 0, mano: 0, total: 0 }
    );
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
          {/* Payment Method Filter */}
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
                <option key={method.id} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Joint */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900 mb-1">Joint</div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(totals.joint)}</div>
            </div>

            {/* Subi */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-900 mb-1">Subi Personal</div>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(totals.subi)}</div>
            </div>

            {/* Mano */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm font-medium text-orange-900 mb-1">Mano Personal</div>
              <div className="text-2xl font-bold text-orange-900">{formatCurrency(totals.mano)}</div>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-1">Total Payments Made</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total)}</div>
          </div>

          {/* Breakdown by Payment Method */}
          {Object.keys(displayData).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Breakdown by Payment Method:
              </div>
              <div className="space-y-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Payment Method</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Joint</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Subi</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Mano</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(displayData)
                      .filter(([_, breakdown]) => breakdown.total > 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([method, breakdown]) => (
                        <tr key={method} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{method}</td>
                          <td className="px-3 py-2 text-sm text-right text-blue-900">{formatCurrency(breakdown.joint)}</td>
                          <td className="px-3 py-2 text-sm text-right text-green-900">{formatCurrency(breakdown.subi)}</td>
                          <td className="px-3 py-2 text-sm text-right text-orange-900">{formatCurrency(breakdown.mano)}</td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">{formatCurrency(breakdown.total)}</td>
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

