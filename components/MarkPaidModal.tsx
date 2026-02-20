'use client';

import { useState, useEffect } from 'react';
import { PaymentMethod, PaidBy } from '@/types/database';

interface Account {
  id: string;
  name: string;
  type: string;
  is_shared: boolean;
}

interface MarkPaidModalProps {
  paymentMethod: PaymentMethod;
  onClose: () => void;
  onConfirm: (paidBy: PaidBy, accountId?: string) => Promise<void>;
}

export default function MarkPaidModal({
  paymentMethod,
  onClose,
  onConfirm,
}: MarkPaidModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch('/api/accounts', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAccounts(data);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };
    loadAccounts();
  }, []);

  const handleConfirm = async () => {
    if (!selectedAccountId) {
      setError('Please select which account this was paid from');
      return;
    }

    setLoading(true);
    setError(null);

    const account = accounts.find(a => a.id === selectedAccountId);
    const paidBy: PaidBy = account?.is_shared ? 'joint' : 'mano';

    try {
      await onConfirm(paidBy, selectedAccountId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark transactions as paid');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Mark as Paid</h2>

          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              Mark all unpaid transactions for <span className="font-semibold">{paymentMethod}</span> as paid.
            </p>
            <p className="text-sm text-gray-500">
              The selected account&apos;s balance will be adjusted automatically.
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="paid-from-account" className="block text-sm font-medium mb-2 text-gray-700">
              Paid From Account <span className="text-red-500">*</span>
            </label>
            {loadingAccounts ? (
              <div className="text-sm text-gray-400 py-2">Loading accounts...</div>
            ) : (
              <select
                id="paid-from-account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.is_shared ? ' (shared)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
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
              disabled={!selectedAccountId || loading}
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
