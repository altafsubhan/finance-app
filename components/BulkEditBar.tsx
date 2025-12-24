'use client';

import { useState } from 'react';
import { Category, PaymentMethod, PaidBy } from '@/types/database';
import { PAYMENT_METHODS, PAID_BY_OPTIONS } from '@/lib/constants';

interface BulkEditBarProps {
  selectedCount: number;
  categories: Category[];
  onBulkUpdate: (updates: {
    category_id?: string;
    payment_method?: PaymentMethod;
    paid_by?: PaidBy;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function BulkEditBar({ selectedCount, categories, onBulkUpdate, onCancel }: BulkEditBarProps) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paidBy, setPaidBy] = useState<PaidBy | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const updates: {
      category_id?: string;
      payment_method?: PaymentMethod;
      paid_by?: PaidBy;
    } = {};

    if (categoryId) updates.category_id = categoryId;
    if (paymentMethod) updates.payment_method = paymentMethod as PaymentMethod;
    if (paidBy !== '') updates.paid_by = paidBy as PaidBy;

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
    } catch (err: any) {
      setError(err.message || 'Failed to update transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">
              {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="bulk-category" className="sr-only">Category</label>
                <select
                  id="bulk-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Category (optional) --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bulk-payment-method" className="sr-only">Payment Method</label>
                <select
                  id="bulk-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Payment Method (optional) --</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bulk-paid-by" className="sr-only">Paid By</label>
                <select
                  id="bulk-paid-by"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value as PaidBy || '')}
                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Paid By (optional) --</option>
                  {PAID_BY_OPTIONS.map((option) => (
                    <option key={option.value || 'null'} value={option.value || ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Apply to Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

