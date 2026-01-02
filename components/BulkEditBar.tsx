'use client';

import { useState } from 'react';
import { Category, PaymentMethod, PaidBy } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface BulkEditBarProps {
  selectedCount: number;
  selectedIds: string[];
  selectedTransactions: Array<{ id: string; amount: number }>; // For calculating total
  categories: Category[];
  onBulkUpdate: (updates: {
    category_id?: string | null;
    payment_method?: PaymentMethod;
    paid_by?: PaidBy;
    date?: string | null;
  }) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkEdit: (transactionId: string) => void;
  onBulkSplit: (transactionId: string) => void;
  onCancel: () => void;
}

export default function BulkEditBar({ selectedCount, selectedIds, selectedTransactions, categories, onBulkUpdate, onBulkDelete, onBulkEdit, onBulkSplit, onCancel }: BulkEditBarProps) {
  const { paymentMethods } = usePaymentMethods();
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paidBy, setPaidBy] = useState<PaidBy | '' | 'not_paid'>(''); // 'not_paid' is used internally to represent null
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate total of selected transactions
  const selectedTotal = selectedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const handleApply = async () => {
    const updates: {
      category_id?: string | null;
      payment_method?: PaymentMethod;
      paid_by?: PaidBy;
      date?: string | null;
    } = {};

    // Handle category: empty string means no change, "uncategorized" means set to null
    if (categoryId === 'uncategorized') {
      updates.category_id = null;
    } else if (categoryId) {
      updates.category_id = categoryId;
    }
    
    if (paymentMethod) updates.payment_method = paymentMethod as PaymentMethod;
    
    // Handle paid_by: empty string means no change, "not_paid" means set to null
    if (paidBy === 'not_paid') {
      updates.paid_by = null;
    } else if (paidBy !== '') {
      updates.paid_by = paidBy as PaidBy;
    }

    // Handle date: empty string means no change
    if (date) {
      updates.date = date;
    }

    if (Object.keys(updates).length === 0) {
      setError('Please select at least one field to update');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onBulkUpdate(updates);
      // Reset form
      setCategoryId('');
      setPaymentMethod('');
      setPaidBy('');
      setDate('');
    } catch (err: any) {
      setError(err.message || 'Failed to update transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCount} transaction${selectedCount !== 1 ? 's' : ''}?`)) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      await onBulkDelete(selectedIds);
    } catch (err: any) {
      setError(err.message || 'Failed to delete transactions');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = () => {
    // Edit the first selected transaction (should only be called when one is selected)
    if (selectedIds.length === 1) {
      onBulkEdit(selectedIds[0]);
    }
  };

  const handleSplit = () => {
    // Split the first selected transaction (should only be called when one is selected)
    if (selectedIds.length === 1) {
      onBulkSplit(selectedIds[0]);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <span className="text-sm font-bold text-blue-600 whitespace-nowrap">
                Total: ${selectedTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {error && (
                <span className="text-xs text-red-600">{error}</span>
              )}
              {selectedCount === 1 && (
                <>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSplit}
                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 whitespace-nowrap"
                  >
                    Split
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'Updating...' : 'Apply'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="bulk-date" className="sr-only">Date</label>
              <input
                id="bulk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label htmlFor="bulk-category" className="sr-only">Category</label>
              <select
                id="bulk-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Category (no change)</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label htmlFor="bulk-payment-method" className="sr-only">Payment Method</label>
              <select
                id="bulk-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Payment Method</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.name}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[120px]">
              <label htmlFor="bulk-paid-by" className="sr-only">Paid By</label>
              <select
                id="bulk-paid-by"
                value={paidBy === 'not_paid' ? 'not_paid' : (paidBy || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'not_paid') {
                    setPaidBy('not_paid');
                  } else if (value === '') {
                    setPaidBy('');
                  } else {
                    setPaidBy(value as PaidBy);
                  }
                }}
                className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Paid By (no change)</option>
                <option value="not_paid">Not Paid</option>
                {PAID_BY_OPTIONS.filter(opt => opt.value !== null).map((option) => (
                  <option key={option.value || ''} value={option.value || ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

