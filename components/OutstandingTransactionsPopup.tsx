'use client';

import { useMemo } from 'react';
import { Transaction, Category } from '@/types/database';

interface OutstandingTransactionsPopupProps {
  paymentMethod: string;
  transactions: Transaction[];
  categories: Category[];
  onClose: () => void;
  onMarkPaid: () => void;
}

export default function OutstandingTransactionsPopup({
  paymentMethod,
  transactions,
  categories,
  onClose,
  onMarkPaid,
}: OutstandingTransactionsPopupProps) {
  const getCategoryType = (categoryId: string | null) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    return cat?.type || null;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '';
    return categories.find(c => c.id === categoryId)?.name || '';
  };

  const outstandingTransactions = useMemo(() => {
    return transactions
      .filter(t =>
        t.payment_method === paymentMethod &&
        t.paid_by === null &&
        t.category_id !== null &&
        getCategoryType(t.category_id) !== null
      )
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, paymentMethod, categories]);

  const total = outstandingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (date: string | null) => {
    if (!date) return '\u2014';
    try {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return date;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{paymentMethod}</h3>
            <p className="text-sm text-gray-500">
              {outstandingTransactions.length} outstanding &middot; {formatCurrency(total)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100">
          {outstandingTransactions.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No outstanding transactions</div>
          ) : (
            outstandingTransactions.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{t.description}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(t.date)}
                    {getCategoryName(t.category_id) && (
                      <> &middot; {getCategoryName(t.category_id)}</>
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 ml-3 shrink-0">
                  {formatCurrency(Math.abs(t.amount))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
          {outstandingTransactions.length > 0 && (
            <button
              onClick={onMarkPaid}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Mark All as Paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
