'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type IncomeEntryType = 'income' | '401k' | 'hsa';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
}

interface IncomeEntry {
  id: string;
  entry_type: IncomeEntryType;
  account_id: string;
  amount: number;
  received_date: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface IncomeFormState {
  entry_type: IncomeEntryType;
  account_id: string;
  amount: string;
  received_date: string;
  source: string;
  notes: string;
}

const ENTRY_TYPE_OPTIONS: Array<{ value: IncomeEntryType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: '401k', label: '401k Contribution' },
  { value: 'hsa', label: 'HSA Contribution' },
];

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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

function makeDefaultForm(accountId = ''): IncomeFormState {
  return {
    entry_type: 'income',
    account_id: accountId,
    amount: '',
    received_date: getTodayDate(),
    source: '',
    notes: '',
  };
}

export default function IncomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<IncomeFormState>(makeDefaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<IncomeFormState>(makeDefaultForm());

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

  const incomeEntries = useMemo(
    () => entries.filter((entry) => entry.entry_type === 'income'),
    [entries]
  );

  const total401kContribution = useMemo(
    () =>
      entries
        .filter((entry) => entry.entry_type === '401k')
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
    [entries]
  );

  const totalHsaContribution = useMemo(
    () =>
      entries
        .filter((entry) => entry.entry_type === 'hsa')
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
    [entries]
  );

  const monthlyTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    incomeEntries.forEach((entry) => {
      const monthIndex = new Date(`${entry.received_date}T00:00:00`).getMonth();
      if (monthIndex >= 0 && monthIndex < 12) {
        totals[monthIndex] += Number(entry.amount);
      }
    });
    return totals;
  }, [incomeEntries]);

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
    const response = await fetch('/api/accounts', {
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load accounts');
    }

    return response.json();
  }, []);

  const loadIncomeEntries = useCallback(async (year: number): Promise<IncomeEntry[]> => {
    const response = await fetch(`/api/income?year=${year}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load income entries');
    }

    return response.json();
  }, []);

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
        body: JSON.stringify({
          entry_type: newEntry.entry_type,
          account_id: newEntry.account_id,
          amount,
          received_date: newEntry.received_date,
          source: newEntry.source,
          notes: newEntry.notes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to save income entry');
      }

      setNewEntry((prev) => ({
        ...makeDefaultForm(prev.account_id),
        account_id: prev.account_id,
      }));
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
      entry_type: entry.entry_type,
      account_id: entry.account_id,
      amount: String(entry.amount),
      received_date: entry.received_date,
      source: entry.source || '',
      notes: entry.notes || '',
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
        body: JSON.stringify({
          entry_type: editEntry.entry_type,
          account_id: editEntry.account_id,
          amount: parsedAmount,
          received_date: editEntry.received_date,
          source: editEntry.source,
          notes: editEntry.notes,
        }),
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
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Income</h1>
            <p className="text-sm text-gray-500 mt-1">
              Private monthly income tracking with account destination details.
            </p>
          </div>
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
              Add an account first so you can track where income is deposited.{' '}
              <Link href="/accounts" className="font-medium underline hover:text-amber-900">
                Go to Accounts
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={handleAddIncome} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type *</label>
                <select
                  value={newEntry.entry_type}
                  onChange={(e) =>
                    setNewEntry((prev) => ({
                      ...prev,
                      entry_type: e.target.value as IncomeEntryType,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ENTRY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="block text-xs text-gray-500 mb-1">Source</label>
                <input
                  type="text"
                  value={newEntry.source}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g. Salary"
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
              <div className="sm:col-span-2 lg:col-span-7 flex justify-end">
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
            <p className="text-sm text-gray-500">Total Income ({selectedYear})</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalIncomeForYear)}</p>
            <p className="text-xs text-gray-400 mt-1">Excludes 401k and HSA contributions</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Average Active Month</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(averageMonthlyIncome)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {monthsWithIncome} month{monthsWithIncome === 1 ? '' : 's'} with income
            </p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Income Entries</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{incomeEntries.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">401k Contribution ({selectedYear})</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {formatCurrency(total401kContribution)}
            </p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">HSA Contribution ({selectedYear})</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">
              {formatCurrency(totalHsaContribution)}
            </p>
          </div>
        </div>

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
          {entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No entries recorded for {selectedYear} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 px-4 sm:px-6 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Account</th>
                    <th className="py-3 px-4 font-medium">Source</th>
                    <th className="py-3 px-4 font-medium">Notes</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 sm:px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
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
                            <select
                              value={editEntry.entry_type}
                              onChange={(e) =>
                                setEditEntry((prev) => ({
                                  ...prev,
                                  entry_type: e.target.value as IncomeEntryType,
                                }))
                              }
                              className="px-2 py-1 border rounded bg-white text-gray-900"
                            >
                              {ENTRY_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">
                              {ENTRY_TYPE_OPTIONS.find((option) => option.value === entry.entry_type)
                                ?.label || entry.entry_type}
                            </span>
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
