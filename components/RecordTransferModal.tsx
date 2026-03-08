'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  is_shared: boolean;
  investment_portfolio_enabled?: boolean;
}

interface RecordTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordTransferModal({ isOpen, onClose, onSuccess }: RecordTransferModalProps) {
  const [personalAccounts, setPersonalAccounts] = useState<Account[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<Account[]>([]);
  const [transferType, setTransferType] = useState<'money' | 'stock'>('money');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockShares, setStockShares] = useState('');
  const [skipBalance, setSkipBalance] = useState(false);
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

    if (fromAccount && fromAccount === toAccount) {
      setError('From and to accounts must be different');
      return;
    }

    if (transferType === 'money') {
      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }
    } else {
      if (!stockSymbol.trim()) {
        setError('Stock symbol is required for stock transfers');
        return;
      }
      const parsedShares = parseFloat(stockShares);
      if (!parsedShares || parsedShares <= 0) {
        setError('Stock shares must be greater than 0');
        return;
      }
    }

    setSaving(true);
    try {
      const allDestinationAccounts = [...personalAccounts, ...sharedAccounts];
      const fromName = allDestinationAccounts.find(a => a.id === fromAccount)?.name || 'Account';
      const toName = allDestinationAccounts.find(a => a.id === toAccount)?.name || 'Account';

      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          from_account_name: fromName,
          to_account_name: toName,
          to_account_id: toAccount || null,
          from_account_id: fromAccount || null,
          date,
          notes,
          year,
          month,
          transfer_type: transferType,
          stock_symbol: transferType === 'stock' ? stockSymbol : undefined,
          stock_shares: transferType === 'stock' ? parseFloat(stockShares) : undefined,
          skip_balance_update: skipBalance,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record transfer');
      }

      setAmount('');
      setNotes('');
      setStockSymbol('');
      setStockShares('');
      setSkipBalance(false);
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

  const accountOptions = (
    <>
      {personalAccounts.length > 0 && (
        <optgroup label="Personal Accounts">
          {personalAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </optgroup>
      )}
      {sharedAccounts.length > 0 && (
        <optgroup label="Shared Accounts">
          {sharedAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </optgroup>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold">Record Transfer</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTransferType('money')}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  transferType === 'money'
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                Money
              </button>
              <button
                type="button"
                onClick={() => setTransferType('stock')}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  transferType === 'stock'
                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                Stock
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {transferType === 'money'
              ? 'Record a money transfer. Creates a personal expense and income on the destination.'
              : 'Record a stock transfer between investment accounts.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select account (optional)</option>
                {accountOptions}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Account *</label>
              <select
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select destination account</option>
                {accountOptions}
              </select>
            </div>

            {transferType === 'stock' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Symbol *</label>
                  <input
                    type="text"
                    value={stockSymbol}
                    onChange={(e) => setStockSymbol(e.target.value)}
                    placeholder="e.g. AAPL"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shares *</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={stockShares}
                    onChange={(e) => setStockShares(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dollar Value (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </>
            ) : (
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
            )}

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

            {/* Skip balance update */}
            {transferType === 'money' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipBalance}
                  onChange={(e) => setSkipBalance(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>
                  Skip balance update
                  <span className="text-xs text-gray-400 ml-1">(for older records)</span>
                </span>
              </label>
            )}

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
                disabled={saving || !toAccount}
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
