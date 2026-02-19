'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  is_shared: boolean;
}

interface RecordTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordTransferModal({ isOpen, onClose, onSuccess }: RecordTransferModalProps) {
  const [personalAccounts, setPersonalAccounts] = useState<Account[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<Account[]>([]);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date();
  const [year] = useState(currentDate.getFullYear());
  const [month] = useState(currentDate.getMonth() + 1);

  useEffect(() => {
    if (!isOpen) return;

    const loadAccounts = async () => {
      try {
        const [personalRes, sharedRes] = await Promise.all([
          fetch('/api/accounts?is_shared=false', { credentials: 'include' }),
          fetch('/api/accounts?is_shared=true', { credentials: 'include' }),
        ]);

        if (personalRes.ok) {
          setPersonalAccounts(await personalRes.json());
        }
        if (sharedRes.ok) {
          setSharedAccounts(await sharedRes.json());
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };

    loadAccounts();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const fromName = personalAccounts.find(a => a.id === fromAccount)?.name || 'Personal';
      const toName = sharedAccounts.find(a => a.id === toAccount)?.name || 'Shared';

      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parsedAmount,
          from_account_name: fromName,
          to_account_name: toName,
          date,
          notes,
          year,
          month,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record transfer');
      }

      setAmount('');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record transfer');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-1">Record Transfer</h2>
          <p className="text-sm text-gray-500 mb-4">
            Record a money transfer from a personal account to a shared account.
            This creates a personal expense entry.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From (Personal Account)</label>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select account (optional)</option>
                {personalAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To (Shared Account)</label>
              <select
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select account (optional)</option>
                {sharedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !amount}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Recording...' : 'Record Transfer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
