'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type IncomeEntryType = 'income' | '401k' | 'hsa';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  is_shared: boolean;
}

interface IncomeEntry {
  id: string;
  entry_type: IncomeEntryType;
  account_id: string;
  amount: number;
  received_date: string;
  source: string | null;
  notes: string | null;
  tags?: string[] | null;
  stock_symbol?: string | null;
  stock_shares?: number | null;
  created_at: string;
}

interface IncomeFormState {
  account_id: string;
  amount: string;
  received_date: string;
  source: string;
  notes: string;
  tags: string;
  stock_symbol: string;
  stock_shares: string;
}

interface IncomePageContentProps {
  scope: 'personal' | 'shared';
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateValue: string): string {
  const parsed = new Date(`${dateValue}T00:00:00`);
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function parseTagInput(tagsValue: string): string[] {
  return Array.from(
    new Set(
      tagsValue
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function getEntryTags(entry: IncomeEntry): string[] {
  if (entry.tags && entry.tags.length > 0) return entry.tags;
  if (entry.entry_type !== 'income') return [entry.entry_type];
  return ['income'];
}

function makeDefaultForm(accountId = ''): IncomeFormState {
  return {
    account_id: accountId,
    amount: '',
    received_date: getTodayDate(),
    source: '',
    notes: '',
    tags: '',
    stock_symbol: '',
    stock_shares: '',
  };
}

export default function IncomePageContent({ scope }: IncomePageContentProps) {
  const isShared = scope === 'shared';
  const scopeLabel = isShared ? 'Shared' : 'Personal';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<IncomeFormState>(makeDefaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<IncomeFormState>(makeDefaultForm());
  const [showStockFields, setShowStockFields] = useState(false);

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i),
    []
  );

  const accountNameById = useMemo(() => {
    return accounts.reduce<Record<string, string>>((acc, account) => {
      acc[account.id] = account.name;
      return acc;
    }, {});
  }, [accounts]);

  const tagTotals = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach((entry) => {
      const amount = Number(entry.amount);
      getEntryTags(entry).forEach((tag) => {
        totals.set(tag, (totals.get(tag) || 0) + amount);
      });
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filteredEntries = useMemo(
    () => (selectedTag ? entries.filter((entry) => getEntryTags(entry).includes(selectedTag)) : entries),
    [entries, selectedTag]
  );

  const monthlyTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    filteredEntries.forEach((entry) => {
      const monthIndex = new Date(`${entry.received_date}T00:00:00`).getMonth();
      if (monthIndex >= 0 && monthIndex < 12) {
        totals[monthIndex] += Number(entry.amount);
      }
    });
    return totals;
  }, [filteredEntries]);

  const totalIncomeForYear = useMemo(
    () => monthlyTotals.reduce((sum, value) => sum + value, 0),
    [monthlyTotals]
  );

  const monthsWithIncome = useMemo(
    () => monthlyTotals.filter((value) => value > 0).length,
    [monthlyTotals]
  );

  const averageMonthlyIncome = useMemo(() => {
    if (monthsWithIncome === 0) return 0;
    return totalIncomeForYear / monthsWithIncome;
  }, [monthsWithIncome, totalIncomeForYear]);

  const loadAccounts = useCallback(async (): Promise<Account[]> => {
    const response = await fetch(`/api/accounts?is_shared=${isShared}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load accounts');
    }

    return response.json();
  }, [isShared]);

  const loadIncomeEntries = useCallback(async (year: number): Promise<IncomeEntry[]> => {
    const response = await fetch(`/api/income?year=${year}&is_shared=${isShared}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load income entries');
    }

    return response.json();
  }, [isShared]);

  const refreshIncomeEntries = useCallback(async () => {
    const incomeData = await loadIncomeEntries(selectedYear);
    setEntries(incomeData);
  }, [loadIncomeEntries, selectedYear]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [accountData, incomeData] = await Promise.all([
        loadAccounts(),
        loadIncomeEntries(selectedYear),
      ]);

      setAccounts(accountData);
      setEntries(incomeData);
      setNewEntry((prev) => {
        const existingAccountStillVisible = accountData.some(
          (account) => account.id === prev.account_id
        );
        if (existingAccountStillVisible) {
          return prev;
        }
        return {
          ...prev,
          account_id: accountData[0]?.id || '',
        };
      });
    } catch (loadError: any) {
      console.error('Failed to load income page:', loadError);
      setError(loadError?.message || 'Failed to load income data');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadIncomeEntries, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buildPayload = (form: IncomeFormState) => {
    const tags = parseTagInput(form.tags);
    const payload: Record<string, unknown> = {
      account_id: form.account_id,
      amount: Number(form.amount),
      received_date: form.received_date,
      source: form.source,
      notes: form.notes,
      tags,
    };

    if (form.stock_symbol.trim() || form.stock_shares.trim()) {
      payload.stock_symbol = form.stock_symbol.trim().toUpperCase();
      payload.stock_shares = Number(form.stock_shares);
      if (!tags.includes('rsu') && !tags.includes('espp')) {
        payload.tags = [...tags, 'stock'];
      }
    }

    return payload;
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newEntry.account_id) {
      setError('Please select an account');
      return;
    }

    const amount = Number(newEntry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (!newEntry.received_date) {
      setError('Please select a received date');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildPayload(newEntry)),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to save income entry');
      }

      setNewEntry((prev) => ({
        ...makeDefaultForm(prev.account_id),
        account_id: prev.account_id,
      }));
      setShowStockFields(false);
      await refreshIncomeEntries();
    } catch (saveError: any) {
      console.error('Failed to save income entry:', saveError);
      setError(saveError?.message || 'Failed to save income entry');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (entry: IncomeEntry) => {
    setError(null);
    setEditingId(entry.id);
    setEditEntry({
      account_id: entry.account_id,
      amount: String(entry.amount),
      received_date: entry.received_date,
      source: entry.source || '',
      notes: entry.notes || '',
      tags: getEntryTags(entry).join(', '),
      stock_symbol: entry.stock_symbol || '',
      stock_shares: entry.stock_shares ? String(entry.stock_shares) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEntry(makeDefaultForm());
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);

    if (!editEntry.account_id) {
      setError('Please select an account');
      return;
    }

    const parsedAmount = Number(editEntry.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (!editEntry.received_date) {
      setError('Please select a received date');
      return;
    }

    try {
      setSavingEdit(true);
      const response = await fetch(`/api/income/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildPayload(editEntry)),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to update income entry');
      }

      setEditingId(null);
      await refreshIncomeEntries();
    } catch (updateError: any) {
      console.error('Failed to update income entry:', updateError);
      setError(updateError?.message || 'Failed to update income entry');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (entry: IncomeEntry) => {
    if (
      !confirm(
        `Delete income entry (${formatCurrency(Number(entry.amount))} on ${formatDate(
          entry.received_date
        )})?`
      )
    ) {
      return;
    }

    setError(null);
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/income/${entry.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to delete income entry');
      }

      await refreshIncomeEntries();
    } catch (deleteError: any) {
      console.error('Failed to delete income entry:', deleteError);
      setError(deleteError?.message || 'Failed to delete income entry');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="text-center py-12">Loading...</div>
      </main>
    );
  }

  const accountsPath = isShared ? '/shared/accounts' : '/personal/accounts';

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{scopeLabel} Income</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isShared ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {isShared ? 'Shared' : 'Private'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {isShared ? 'Shared income tracking deposited into joint accounts.' : 'Personal income tracking with account destination details.'}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            {tagTotals.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Filter by Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All tags</option>
                  {tagTotals.map(([tag]) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Income Entry</h2>
          {accounts.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Add a {scope} account first so you can track where income is deposited.{' '}
              <Link href={accountsPath} className="font-medium underline hover:text-amber-900">
                Go to {scopeLabel} Accounts
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={handleAddIncome} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Deposited Into *</label>
                  <select
                    value={newEntry.account_id}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, account_id: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Received Date *</label>
                  <input
                    type="date"
                    value={newEntry.received_date}
                    onChange={(e) =>
                      setNewEntry((prev) => ({ ...prev, received_date: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tags</label>
                  <input
                    type="text"
                    value={newEntry.tags}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="salary, rsu, 401k, hsa"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    value={newEntry.source}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g. Employer"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {showStockFields ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stock Symbol</label>
                    <input
                      type="text"
                      value={newEntry.stock_symbol}
                      onChange={(e) =>
                        setNewEntry((prev) => ({ ...prev, stock_symbol: e.target.value }))
                      }
                      placeholder="e.g. AAPL"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stock Shares</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={newEntry.stock_shares}
                      onChange={(e) =>
                        setNewEntry((prev) => ({ ...prev, stock_shares: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStockFields(false);
                        setNewEntry((prev) => ({ ...prev, stock_symbol: '', stock_shares: '' }));
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
                  onClick={() => setShowStockFields(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Add stock income (RSU/ESPP)
                </button>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || accounts.length === 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Income'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              Total {selectedTag ? `(${selectedTag})` : 'Income'} ({selectedYear})
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalIncomeForYear)}</p>
            {!selectedTag && (
              <p className="text-xs text-gray-400 mt-1">All tags included</p>
            )}
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Average Active Month</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(averageMonthlyIncome)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {monthsWithIncome} month{monthsWithIncome === 1 ? '' : 's'} with income
            </p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Entries</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filteredEntries.length}</p>
          </div>
        </div>

        {tagTotals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tagTotals.map(([tag, total]) => (
              <div
                key={tag}
                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-colors ${
                  selectedTag === tag ? 'border-blue-400 bg-blue-50' : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
              >
                <p className="text-sm text-gray-500 capitalize">{tag}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(total)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Income</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {MONTH_NAMES.map((monthName, index) => {
              const total = monthlyTotals[index];
              return (
                <div
                  key={monthName}
                  className={`rounded-lg border p-3 ${
                    total > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <p className="text-xs text-gray-500">{monthName}</p>
                  <p className={`text-sm font-semibold mt-1 ${total > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {formatCurrency(total)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Income Entries</h2>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No entries recorded for {selectedYear}{selectedTag ? ` with tag "${selectedTag}"` : ''} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 px-4 sm:px-6 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Tags</th>
                    <th className="py-3 px-4 font-medium">Account</th>
                    <th className="py-3 px-4 font-medium">Source</th>
                    <th className="py-3 px-4 font-medium">Notes</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 sm:px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => {
                    const isEditing = editingId === entry.id;
                    return (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 sm:px-6">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editEntry.received_date}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, received_date: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-700">{formatDate(entry.received_date)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editEntry.tags}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, tags: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900 w-36"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {getEntryTags(entry).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                              {entry.stock_symbol && (
                                <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                  {entry.stock_symbol} ({entry.stock_shares})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <select
                              value={editEntry.account_id}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, account_id: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900"
                            >
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">
                              {accountNameById[entry.account_id] || 'Unknown account'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editEntry.source}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, source: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900 w-32"
                            />
                          ) : (
                            <span className="text-gray-600">{entry.source || '-'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editEntry.notes}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, notes: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900 w-40"
                            />
                          ) : (
                            <span className="text-gray-600">{entry.notes || '-'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editEntry.amount}
                              onChange={(e) =>
                                setEditEntry((prev) => ({ ...prev, amount: e.target.value }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900 w-28 text-right"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(Number(entry.amount))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 sm:px-6">
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(entry.id)}
                                  disabled={savingEdit}
                                  className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => beginEdit(entry)}
                                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(entry)}
                                  disabled={deletingId === entry.id}
                                  className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
