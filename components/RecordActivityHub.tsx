'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Category } from '@/types/database';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import CSVImport from '@/components/CSVImport';
import ScreenshotImport from '@/components/ScreenshotImport';

// ─── Types ──────────────────────────────────────────────────────────

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  is_shared: boolean;
  investment_portfolio_enabled?: boolean;
}

type ActiveTab = 'expense' | 'income' | 'transfer' | 'import';

// ─── Helpers ────────────────────────────────────────────────────────

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

const TAB_ITEMS: { key: ActiveTab; label: string; icon: string }[] = [
  { key: 'expense', label: 'Expense', icon: '💳' },
  { key: 'income', label: 'Income', icon: '💰' },
  { key: 'transfer', label: 'Transfer', icon: '🔄' },
  { key: 'import', label: 'Import', icon: '📥' },
];

// ─── Component ──────────────────────────────────────────────────────

export default function RecordActivityHub() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('expense');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { paymentMethods } = usePaymentMethods();

  const personalAccounts = useMemo(() => accounts.filter((a) => !a.is_shared), [accounts]);
  const sharedAccounts = useMemo(() => accounts.filter((a) => a.is_shared), [accounts]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [accountsRes, sharedCatRes, personalCatRes] = await Promise.all([
        fetch('/api/accounts', { credentials: 'include' }),
        fetch('/api/categories?is_shared=true', { credentials: 'include' }),
        fetch('/api/categories?is_shared=false', { credentials: 'include' }),
      ]);

      if (accountsRes.ok) setAccounts(await accountsRes.json());

      const sharedCats = sharedCatRes.ok ? await sharedCatRes.json() : [];
      const personalCats = personalCatRes.ok ? await personalCatRes.json() : [];
      setCategories([...sharedCats, ...personalCats]);
    } catch {
      console.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center py-16 text-gray-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Record Activity</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add expenses, income, transfers, or import transactions — all in one place.
          </p>
        </div>

        {/* Success toast */}
        {successMessage && (
          <div className="p-3 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm flex items-center gap-2">
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-gray-200">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white border rounded-xl p-5 sm:p-6 shadow-sm">
          {activeTab === 'expense' && (
            <ExpenseForm
              categories={categories}
              accounts={accounts}
              paymentMethods={paymentMethods}
              onSuccess={(msg) => showSuccess(msg)}
            />
          )}
          {activeTab === 'income' && (
            <IncomeForm
              accounts={accounts}
              onSuccess={(msg) => showSuccess(msg)}
            />
          )}
          {activeTab === 'transfer' && (
            <TransferForm
              personalAccounts={personalAccounts}
              sharedAccounts={sharedAccounts}
              onSuccess={(msg) => showSuccess(msg)}
            />
          )}
          {activeTab === 'import' && (
            <ImportSection
              categories={categories}
              onSuccess={() => showSuccess('Transactions imported successfully')}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Expense Form ───────────────────────────────────────────────────

function ExpenseForm({
  categories,
  accounts,
  paymentMethods,
  onSuccess,
}: {
  categories: Category[];
  accounts: Account[];
  paymentMethods: { id: string; name: string }[];
  onSuccess: (msg: string) => void;
}) {
  const [isShared, setIsShared] = useState(true);
  const [date, setDate] = useState(getTodayDate());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [skipBalance, setSkipBalance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.is_shared === isShared),
    [categories, isShared]
  );

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Derive month/quarter/year from the date
    const parsedDate = date ? new Date(`${date}T00:00:00`) : null;
    const month = parsedDate ? parsedDate.getMonth() + 1 : currentMonth;
    const year = parsedDate ? parsedDate.getFullYear() : currentYear;
    const quarter = Math.ceil(month / 3);

    setSaving(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: date || null,
          amount: parsedAmount,
          description,
          category_id: categoryId || null,
          payment_method: paymentMethod || 'Other',
          paid_by: paidBy || null,
          month,
          quarter,
          year,
          is_shared: isShared,
          skip_balance_update: skipBalance,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save expense');
      }

      onSuccess(`Expense of ${formatCurrency(parsedAmount)} recorded${isShared ? ' (shared)' : ' (personal)'}`);
      // Reset form but keep scope and payment method
      setAmount('');
      setDescription('');
      setCategoryId('');
      setPaidBy('');
      setSkipBalance(false);
      setDate(getTodayDate());
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Record Expense</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShared(true)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              isShared ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Shared
          </button>
          <button
            type="button"
            onClick={() => setIsShared(false)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              !isShared ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Personal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this expense for?"
          className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Category
            {!categoryId && <span className="text-amber-500 ml-1">(uncategorized)</span>}
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— No category —</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select —</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.name}>
                {pm.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Paid From Account</label>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Not paid yet —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.is_shared ? ' (shared)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Skip balance update toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={skipBalance}
          onChange={(e) => setSkipBalance(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          Skip balance update
          <span className="text-xs text-gray-400 ml-1">(useful for older records)</span>
        </span>
      </label>

      {error && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saving ? 'Saving...' : 'Save Expense'}
        </button>
      </div>
    </form>
  );
}

// ─── Income Form ────────────────────────────────────────────────────

function IncomeForm({
  accounts,
  onSuccess,
}: {
  accounts: Account[];
  onSuccess: (msg: string) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(getTodayDate());
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [skipBalance, setSkipBalance] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockShares, setStockShares] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError('Please select an account');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        account_id: accountId,
        amount: parsedAmount,
        received_date: receivedDate,
        source,
        notes,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        skip_balance_update: skipBalance,
      };

      if (showStock && stockSymbol.trim()) {
        payload.stock_symbol = stockSymbol.trim().toUpperCase();
        payload.stock_shares = parseFloat(stockShares) || 0;
      }

      const res = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save income');
      }

      const accountName = accounts.find((a) => a.id === accountId)?.name || 'account';
      onSuccess(`Income of ${formatCurrency(parsedAmount)} recorded to ${accountName}`);
      setAmount('');
      setSource('');
      setNotes('');
      setTags('');
      setSkipBalance(false);
      setShowStock(false);
      setStockSymbol('');
      setStockShares('');
      setReceivedDate(getTodayDate());
    } catch (err: any) {
      setError(err.message || 'Failed to save income');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Record Income</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Deposited Into *</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select account</option>
            {accounts.filter((a) => !a.is_shared).length > 0 && (
              <optgroup label="Personal Accounts">
                {accounts
                  .filter((a) => !a.is_shared)
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </optgroup>
            )}
            {accounts.filter((a) => a.is_shared).length > 0 && (
              <optgroup label="Shared Accounts">
                {accounts
                  .filter((a) => a.is_shared)
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Received Date *</label>
          <input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Source</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Employer"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="salary, rsu, 401k, hsa"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showStock ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock Symbol</label>
            <input
              type="text"
              value={stockSymbol}
              onChange={(e) => setStockSymbol(e.target.value)}
              placeholder="e.g. AAPL"
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Shares</label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={stockShares}
              onChange={(e) => setStockShares(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setShowStock(false);
                setStockSymbol('');
                setStockShares('');
              }}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Remove stock fields
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowStock(true)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          + Add stock income (RSU/ESPP)
        </button>
      )}

      {/* Skip balance update toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={skipBalance}
          onChange={(e) => setSkipBalance(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          Skip balance update
          <span className="text-xs text-gray-400 ml-1">(useful for older records)</span>
        </span>
      </label>

      {error && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !accountId}
          className="px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {saving ? 'Saving...' : 'Save Income'}
        </button>
      </div>
    </form>
  );
}

// ─── Transfer Form ──────────────────────────────────────────────────

function TransferForm({
  personalAccounts,
  sharedAccounts,
  onSuccess,
}: {
  personalAccounts: Account[];
  sharedAccounts: Account[];
  onSuccess: (msg: string) => void;
}) {
  const allAccounts = useMemo(() => [...personalAccounts, ...sharedAccounts], [personalAccounts, sharedAccounts]);
  const [transferType, setTransferType] = useState<'money' | 'stock'>('money');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [notes, setNotes] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockShares, setStockShares] = useState('');
  const [skipBalance, setSkipBalance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fromAccount && fromAccount === toAccount) {
      setError('From and to accounts must be different');
      return;
    }

    if (transferType === 'money') {
      const parsedAmount = parseFloat(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }
    } else {
      if (!stockSymbol.trim()) {
        setError('Stock symbol is required for stock transfers');
        return;
      }
      const parsedShares = parseFloat(stockShares);
      if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
        setError('Stock shares must be greater than 0');
        return;
      }
    }

    setSaving(true);
    try {
      const fromName = allAccounts.find((a) => a.id === fromAccount)?.name || 'Account';
      const toName = allAccounts.find((a) => a.id === toAccount)?.name || 'Account';

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          from_account_name: fromName,
          to_account_name: toName,
          from_account_id: fromAccount || null,
          to_account_id: toAccount || null,
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record transfer');
      }

      if (transferType === 'stock') {
        onSuccess(`Transferred ${stockShares} shares of ${stockSymbol.toUpperCase()} from ${fromName} to ${toName}`);
      } else {
        onSuccess(`Transferred ${formatCurrency(parseFloat(amount))} from ${fromName} to ${toName}`);
      }

      setAmount('');
      setNotes('');
      setStockSymbol('');
      setStockShares('');
      setSkipBalance(false);
      setDate(getTodayDate());
    } catch (err: any) {
      setError(err.message || 'Failed to record transfer');
    } finally {
      setSaving(false);
    }
  };

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Record Transfer</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTransferType('money')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
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
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              transferType === 'stock'
                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            Stock
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {transferType === 'money'
          ? 'Record a money transfer between accounts. Transfers between same-type accounts only update balances. Cross-type transfers (personal ↔ shared) also record an expense and income entry.'
          : 'Record a stock transfer between investment accounts. Moves shares from one portfolio to another.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From Account</label>
          <select
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select source (optional)</option>
            {accountOptions}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To Account *</label>
          <select
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select destination</option>
            {accountOptions}
          </select>
        </div>
      </div>

      {transferType === 'stock' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock Symbol *</label>
            <input
              type="text"
              value={stockSymbol}
              onChange={(e) => setStockSymbol(e.target.value)}
              placeholder="e.g. AAPL"
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Shares *</label>
            <input
              type="number"
              step="0.000001"
              min="0.000001"
              value={stockShares}
              onChange={(e) => setStockShares(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dollar Value (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Skip balance update toggle (money transfers only) */}
      {transferType === 'money' && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={skipBalance}
            onChange={(e) => setSkipBalance(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Skip balance update
            <span className="text-xs text-gray-400 ml-1">(useful for older records)</span>
          </span>
        </label>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !toAccount}
          className="px-5 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          {saving ? 'Recording...' : 'Record Transfer'}
        </button>
      </div>
    </form>
  );
}

// ─── Import Section ─────────────────────────────────────────────────

function ImportSection({
  categories,
  onSuccess,
}: {
  categories: Category[];
  onSuccess: () => void;
}) {
  const [importMode, setImportMode] = useState<'csv' | 'screenshot'>('csv');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Import Transactions</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportMode('csv')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              importMode === 'csv'
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            CSV File
          </button>
          <button
            type="button"
            onClick={() => setImportMode('screenshot')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              importMode === 'screenshot'
                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            Screenshot (OCR)
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {importMode === 'csv'
          ? 'Upload a CSV file to import multiple transactions at once. You can classify each transaction as shared or personal in the preview.'
          : 'Upload a screenshot of your transaction list. OCR will extract transactions which you can review and classify as shared or personal.'}
      </p>

      {importMode === 'csv' ? (
        <CSVImport
          categories={categories}
          onSuccess={onSuccess}
        />
      ) : (
        <ScreenshotImport
          categories={categories}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
