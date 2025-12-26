'use client';

import { useState } from 'react';
import { PaymentMethod, PaidBy } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';

interface MarkPaidModalProps {
  paymentMethod: PaymentMethod;
  onClose: () => void;
  onConfirm: (paidBy: PaidBy) => Promise<void>;
}

export default function MarkPaidModal({
  paymentMethod,
  onClose,
  onConfirm,
}: MarkPaidModalProps) {
  const [selectedPaidBy, setSelectedPaidBy] = useState<PaidBy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selectedPaidBy) {
      setError('Please select who paid');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(selectedPaidBy);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark transactions as paid');
      setLoading(false);
    }
  };

  // Filter out the "Not Paid" option
  const paidByOptions = PAID_BY_OPTIONS.filter(opt => opt.value !== null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Mark as Paid</h2>
          
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              Mark all unpaid transactions for <span className="font-semibold">{paymentMethod}</span> as paid by:
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="paid-by-select" className="block text-sm font-medium mb-2 text-gray-700">
              Paid By <span className="text-red-500">*</span>
            </label>
            <select
              id="paid-by-select"
              value={selectedPaidBy || ''}
              onChange={(e) => setSelectedPaidBy(e.target.value ? (e.target.value as PaidBy) : null)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select who paid</option>
              {paidByOptions.map((option) => (
                <option key={option.value || 'null'} value={option.value || ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedPaidBy === null || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Marking as Paid...' : 'Mark as Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

