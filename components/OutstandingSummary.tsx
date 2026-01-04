'use client';

import { useState, useMemo, useRef } from 'react';
import { Transaction, Category, PaymentMethod, PaidBy } from '@/types/database';
import MarkPaidModal from './MarkPaidModal';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface OutstandingSummaryProps {
  transactions: Transaction[];
  categories: Category[];
  categoryTypeFilter?: 'monthly' | 'quarterly' | 'yearly' | ''; // Filter by category type
  onMarkPaid?: () => Promise<void>; // Callback to refresh transactions after marking as paid
}

interface OutstandingBreakdown {
  joint: number;
  subi: number;
  mano: number;
  total: number;
}

export default function OutstandingSummary({ transactions, categories, categoryTypeFilter = '', onMarkPaid }: OutstandingSummaryProps) {
  const { paymentMethods } = usePaymentMethods();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [markingPaidFor, setMarkingPaidFor] = useState<PaymentMethod | null>(null);
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Get category names for personal identification
  const subiPersonalCategoryName = categories.find(c => 
    c.name.toLowerCase().includes('subi') && c.name.toLowerCase().includes('personal')
  )?.name || 'Subi Personal';
  
  const manoPersonalCategoryName = categories.find(c => 
    c.name.toLowerCase().includes('mano') && c.name.toLowerCase().includes('personal')
  )?.name || 'Mano Personal';

  // Helper function to get category type
  const getCategoryType = (categoryId: string | null): 'monthly' | 'quarterly' | 'yearly' | null => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.type || null;
  };

  // Calculate outstanding amounts by payment method
  const outstandingByPaymentMethod = useMemo(() => {
    const result: Record<string, OutstandingBreakdown> = {};

    // Filter to only unpaid transactions (paid_by is null), ignore uncategorized transactions,
    // and filter by category type if specified
    let unpaidTransactions = transactions.filter(t => t.paid_by === null && t.category_id !== null);
    
    // If category type filter is set, only include transactions matching that category type
    if (categoryTypeFilter) {
      unpaidTransactions = unpaidTransactions.filter(t => {
        const categoryType = getCategoryType(t.category_id);
        return categoryType === categoryTypeFilter;
      });
    }

    unpaidTransactions.forEach(transaction => {
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
  }, [transactions, categories, categoryTypeFilter, subiPersonalCategoryName, manoPersonalCategoryName]);

  // Get the selected payment method breakdown or all payment methods
  const displayData = selectedPaymentMethod
    ? { [selectedPaymentMethod]: outstandingByPaymentMethod[selectedPaymentMethod] || { joint: 0, subi: 0, mano: 0, total: 0 } }
    : outstandingByPaymentMethod;

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

  const handleMarkPaid = async (paymentMethod: PaymentMethod, paidBy: PaidBy) => {
    // Filter unpaid transactions with this payment method
    let filteredTransactions = transactions.filter(t => 
      t.payment_method === paymentMethod && 
      t.paid_by === null && 
      t.category_id !== null // Ignore uncategorized
    );

    // Filter by category type based on who paid
    if (paidBy === 'sobi') {
      // Only mark Subi Personal transactions
      filteredTransactions = filteredTransactions.filter(t => {
        const category = categories.find(c => c.id === t.category_id);
        return category && category.name.toLowerCase() === subiPersonalCategoryName.toLowerCase();
      });
    } else if (paidBy === 'mano') {
      // Only mark Mano Personal transactions
      filteredTransactions = filteredTransactions.filter(t => {
        const category = categories.find(c => c.id === t.category_id);
        return category && category.name.toLowerCase() === manoPersonalCategoryName.toLowerCase();
      });
    } else if (paidBy === 'joint') {
      // Only mark joint transactions (not Subi Personal or Mano Personal)
      filteredTransactions = filteredTransactions.filter(t => {
        const category = categories.find(c => c.id === t.category_id);
        if (!category) return false;
        const categoryName = category.name.toLowerCase();
        return categoryName !== subiPersonalCategoryName.toLowerCase() && 
               categoryName !== manoPersonalCategoryName.toLowerCase();
      });
    }

    const transactionIds = filteredTransactions.map(t => t.id);

    if (transactionIds.length === 0) {
      throw new Error(`No unpaid ${paidBy === 'sobi' ? 'Subi Personal' : paidBy === 'mano' ? 'Mano Personal' : 'joint'} transactions found for this payment method`);
    }

    // Call bulk-update API to mark filtered transactions as paid
    const response = await fetch('/api/transactions/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        transaction_ids: transactionIds,
        updates: { paid_by: paidBy },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to mark transactions as paid');
    }

    // Refresh transactions if callback provided
    if (onMarkPaid) {
      await onMarkPaid();
    }
  };

  const handleTouchStart = (e: React.TouchEvent, paymentMethod: PaymentMethod) => {
    e.stopPropagation();
    
    // Store touch position
    if (e.touches.length > 0) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }

    // Clear any existing timer
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
    }

    // Start timer for long-press (500ms)
    touchHoldTimerRef.current = setTimeout(() => {
      setMarkingPaidFor(paymentMethod);
      touchHoldTimerRef.current = null;
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Clear the timer if it hasn't fired yet
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    
    touchStartPosRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // If user moves finger, cancel the hold timer
    if (touchStartPosRef.current && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      
      // If moved more than 10px, cancel
      if (deltaX > 10 || deltaY > 10) {
        if (touchHoldTimerRef.current) {
          clearTimeout(touchHoldTimerRef.current);
          touchHoldTimerRef.current = null;
        }
        touchStartPosRef.current = null;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, paymentMethod: PaymentMethod) => {
    // For desktop, use right-click or long-press simulation
    // For now, we'll use a simpler approach: show on right-click or double-click
    // Actually, let's just use long-press for consistency - desktop users can hold mouse button
    e.stopPropagation();
    
    touchStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
    };

    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
    }

    touchHoldTimerRef.current = setTimeout(() => {
      setMarkingPaidFor(paymentMethod);
      touchHoldTimerRef.current = null;
    }, 500);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    
    touchStartPosRef.current = null;
  };

  const handleMouseLeave = () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

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
          {/* Payment Method Filter */}
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
            <div className="text-sm font-medium text-gray-900 mb-1">Total Outstanding</div>
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
                          title="Long-press to mark as paid"
                        >
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

      {markingPaidFor && (
        <MarkPaidModal
          paymentMethod={markingPaidFor}
          onClose={() => setMarkingPaidFor(null)}
          onConfirm={async (paidBy: PaidBy) => {
            await handleMarkPaid(markingPaidFor, paidBy);
            // Modal will close itself via onClose callback
          }}
        />
      )}
    </div>
  );
}

