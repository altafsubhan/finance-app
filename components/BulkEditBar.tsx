'use client';

import { useState } from 'react';
import { Category, PaymentMethod, PaidBy } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { useAccounts } from '@/lib/hooks/useAccounts';

interface BulkEditBarProps {
  selectedCount: number;
  selectedIds: string[];
  selectedTransactions: Array<{ id: string; amount: number }>;
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
  extraActions?: React.ReactNode;
}

export default function BulkEditBar({ selectedCount, selectedIds, selectedTransactions, categories, onBulkUpdate, onBulkDelete, onBulkEdit, onBulkSplit, onCancel, extraActions }: BulkEditBarProps) {
  const { paymentMethods } = usePaymentMethods();
  const { accounts } = useAccounts();
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paidBy, setPaidBy] = useState<PaidBy | '' | 'not_paid'>('');
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTotal = selectedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const handleApply = async () => {
    const updates: {
      category_id?: string | null;
      payment_method?: PaymentMethod;
      paid_by?: PaidBy;
      date?: string | null;
    } = {};

    if (categoryId === 'uncategorized') {
      updates.category_id = null;
    } else if (categoryId) {
      updates.category_id = categoryId;
    }

    if (paymentMethod) updates.payment_method = paymentMethod as PaymentMethod;

    if (paidBy === 'not_paid') {
      updates.paid_by = null;
    } else if (paidBy !== '') {
      updates.paid_by = paidBy as PaidBy;
    }

    if (date) updates.date = date;

    if (Object.keys(updates).length === 0) {
      setError('Select at least one field to update');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onBulkUpdate(updates);
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
    if (!confirm(`Delete ${selectedCount} transaction${selectedCount !== 1 ? 's' : ''}?`)) return;
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

  const handleEdit = () => { if (selectedIds.length === 1) onBulkEdit(selectedIds[0]); };
  const handleSplit = () => { if (selectedIds.length === 1) onBulkSplit(selectedIds[0]); };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      {/* ── Header row: selection summary ──────────────────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-2.5 pb-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
            {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <span className="text-sm font-bold text-blue-600 whitespace-nowrap">
            ${selectedTotal.toFixed(2)}
          </span>
        </div>
        {error && <span className="text-xs text-red-600 flex-1 text-right">{error}</span>}
      </div>

      {/* ── Fields grid: labeled, stacked on mobile ─────────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="bulk-date" className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Date
            </label>
            <input
              id="bulk-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label htmlFor="bulk-category" className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Category
            </label>
            <select
              id="bulk-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No change</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label htmlFor="bulk-payment-method" className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Payment Method
            </label>
            <select
              id="bulk-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
              className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No change</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label htmlFor="bulk-paid-by" className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Paid By
            </label>
            <select
              id="bulk-paid-by"
              value={paidBy === 'not_paid' ? 'not_paid' : (paidBy || '')}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'not_paid') setPaidBy('not_paid');
                else if (value === '') setPaidBy('');
                else setPaidBy(value as PaidBy);
              }}
              className="w-full px-2 py-1.5 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No change</option>
              <option value="not_paid">Not Paid</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
              {PAID_BY_OPTIONS.filter(opt => opt.value !== null).map((option) => (
                <option key={`legacy-${option.value || ''}`} value={option.value || ''}>
                  {option.label} (legacy)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Action buttons: fixed strip at very bottom ─────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-3 pt-1 flex items-center gap-2 flex-wrap border-t border-gray-100">
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
        {extraActions}
        <button
          onClick={handleDelete}
          disabled={deleteLoading}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
        >
          {deleteLoading ? 'Deleting…' : 'Delete'}
        </button>
        <button
          onClick={handleApply}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Updating…' : 'Apply Changes'}
        </button>
        <button
          onClick={onCancel}
          className="ml-auto px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 whitespace-nowrap"
        >
          Done
        </button>
      </div>
    </div>
  );
}
