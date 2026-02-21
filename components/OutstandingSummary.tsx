'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Transaction, Category, PaymentMethod } from '@/types/database';
import MarkPaidModal from './MarkPaidModal';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface OutstandingSummaryProps {
  transactions: Transaction[];
  categories: Category[];
  categoryTypeFilter?: 'monthly' | 'quarterly' | 'yearly' | '';
  onMarkPaid?: () => Promise<void>;
  defaultExpanded?: boolean;
}

export default function OutstandingSummary({ transactions, categories, categoryTypeFilter = '', onMarkPaid, defaultExpanded = true }: OutstandingSummaryProps) {
  const { paymentMethods } = usePaymentMethods();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [markingPaidFor, setMarkingPaidFor] = useState<PaymentMethod | null>(null);
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const getCategoryType = useCallback((categoryId: string | null): 'monthly' | 'quarterly' | 'yearly' | null => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.type || null;
  }, [categories]);

  const outstandingByPaymentMethod = useMemo(() => {
    const result: Record<string, number> = {};

    let unpaidTransactions = transactions.filter(t => t.paid_by === null && t.category_id !== null);

    if (categoryTypeFilter) {
      unpaidTransactions = unpaidTransactions.filter(t => {
        const categoryType = getCategoryType(t.category_id);
        return categoryType === categoryTypeFilter;
      });
    }

    unpaidTransactions.forEach(transaction => {
      const pm = transaction.payment_method;
      if (!result[pm]) result[pm] = 0;
      result[pm] += Math.abs(transaction.amount);
    });

    return result;
  }, [transactions, categoryTypeFilter, getCategoryType]);

  const displayData = useMemo(() => {
    return selectedPaymentMethod
      ? { [selectedPaymentMethod]: outstandingByPaymentMethod[selectedPaymentMethod] || 0 }
      : outstandingByPaymentMethod;
  }, [selectedPaymentMethod, outstandingByPaymentMethod]);

  const totalOutstanding = useMemo(() => {
    return Object.values(displayData).reduce((sum, v) => sum + v, 0);
  }, [displayData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleMarkPaid = async (paymentMethod: PaymentMethod, accountId: string) => {
    let filteredTransactions = transactions.filter(t =>
      t.payment_method === paymentMethod &&
      t.paid_by === null &&
      t.category_id !== null
    );

    if (categoryTypeFilter) {
      filteredTransactions = filteredTransactions.filter(t => {
        const categoryType = getCategoryType(t.category_id);
        return categoryType === categoryTypeFilter;
      });
    }

    const transactionIds = filteredTransactions.map(t => t.id);

    if (transactionIds.length === 0) {
      throw new Error('No unpaid transactions found for this payment method');
    }

    const response = await fetch('/api/transactions/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        transaction_ids: transactionIds,
        updates: { paid_by: accountId },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to mark transactions as paid');
    }



    if (onMarkPaid) {
      await onMarkPaid();
    }
  };

  const cancelHoldTimer = () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const startHoldTimer = (pos: { x: number; y: number }, paymentMethod: PaymentMethod) => {
    touchStartPosRef.current = pos;
    cancelHoldTimer();
    touchHoldTimerRef.current = setTimeout(() => {
      setMarkingPaidFor(paymentMethod);
      touchHoldTimerRef.current = null;
    }, 500);
  };

  const handleTouchStart = (e: React.TouchEvent, paymentMethod: PaymentMethod) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      startHoldTimer({ x: e.touches[0].clientX, y: e.touches[0].clientY }, paymentMethod);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => { e.stopPropagation(); cancelHoldTimer(); };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) cancelHoldTimer();
    }
  };

  const handleMouseDown = (e: React.MouseEvent, paymentMethod: PaymentMethod) => {
    e.stopPropagation();
    startHoldTimer({ x: e.clientX, y: e.clientY }, paymentMethod);
  };

  const handleMouseUp = (e: React.MouseEvent) => { e.stopPropagation(); cancelHoldTimer(); };
  const handleMouseLeave = () => cancelHoldTimer();

  return (
    <div className="bg-gray-50 border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 rounded-t-lg"
      >
        <span className="font-medium text-gray-900">Outstanding Amounts by Payment Method</span>
        <span className="text-gray-500 text-sm">{isExpanded ? '−' : '+'}</span>
      </button>
      {isExpanded && (
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="summary-payment-method" className="block text-sm font-medium mb-2 text-gray-700">
              Filter by Payment Method
            </label>
            <select
              id="summary-payment-method"
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod | '')}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.name}>{method.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-1">Total Outstanding</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</div>
          </div>

          {Object.keys(displayData).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Breakdown by Payment Method:
              </div>
              <p className="text-xs text-gray-400 mb-2">Long-press a row to mark as paid</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Payment Method</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(displayData)
                      .filter(([_, amount]) => amount > 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([method, amount]) => (
                        <tr
                          key={method}
                          className="hover:bg-gray-50 cursor-pointer"
                          onTouchStart={(e) => handleTouchStart(e, method as PaymentMethod)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchMove}
                          onMouseDown={(e) => handleMouseDown(e, method as PaymentMethod)}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
                          style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                        >
                          <td className="px-3 py-2 text-sm text-gray-900">{method}</td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">{formatCurrency(amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {markingPaidFor && (
        <MarkPaidModal
          paymentMethod={markingPaidFor}
          onClose={() => setMarkingPaidFor(null)}
          onConfirm={async (accountId: string) => {
            await handleMarkPaid(markingPaidFor, accountId);
          }}
        />
      )}
    </div>
  );
}
