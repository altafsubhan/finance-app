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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i), []);

  const accountNameById = useMemo(
    () => accounts.reduce<Record<string, string>>((acc, account) => ({ ...acc, [account.id]: account.name }), {}),
    [accounts]
  );

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
      if (monthIndex >= 0 && monthIndex < 12) totals[monthIndex] += Number(entry.amount);
    });
    return totals;
  }, [filteredEntries]);

  const totalIncomeForYear = useMemo(() => monthlyTotals.reduce((sum, value) => sum + value, 0), [monthlyTotals]);
  const monthsWithIncome = useMemo(() => monthlyTotals.filter((value) => value > 0).length, [monthlyTotals]);
  const averageMonthlyIncome = useMemo(
    () => (monthsWithIncome === 0 ? 0 : totalIncomeForYear / monthsWithIncome),
    [monthsWithIncome, totalIncomeForYear]
  );

  const loadAccounts = useCallback(async (): Promise<Account[]> => {
    const response = await fetch(`/api/accounts?is_shared=${isShared}`, { credentials: 'include' });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load accounts');
    }
    return response.json();
  }, [isShared]);

  const loadIncomeEntries = useCallback(async (year: number): Promise<IncomeEntry[]> => {
    const response = await fetch(`/api/income?year=${year}&is_shared=${isShared}`, { credentials: 'include' });
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
      const [accountData, incomeData] = await Promise.all([loadAccounts(), loadIncomeEntries(selectedYear)]);
      setAccounts(accountData);
      setEntries(incomeData);
      setNewEntry((prev) => ({ ...prev, account_id: accountData.some((a) => a.id === prev.account_id) ? prev.account_id : accountData[0]?.id || '' }));
    } catch (loadError: any) {
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
    if (!newEntry.account_id) return setError('Please select an account');
    const amount = Number(newEntry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than 0');
    if (!newEntry.received_date) return setError('Please select a received date');

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
      setNewEntry((prev) => ({ ...makeDefaultForm(prev.account_id), account_id: prev.account_id }));
      await refreshIncomeEntries();
    } catch (saveError: any) {
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
    if (!editEntry.account_id) return setError('Please select an account');
    const amount = Number(editEntry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than 0');
    if (!editEntry.received_date) return setError('Please select a received date');

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
      setError(updateError?.message || 'Failed to update income entry');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (entry: IncomeEntry) => {
    if (!confirm(`Delete income entry (${formatCurrency(Number(entry.amount))} on ${formatDate(entry.received_date)})?`)) return;
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/income/${entry.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to delete income entry');
      }
      await refreshIncomeEntries();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Failed to delete income entry');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <main className="min-h-screen p-8 bg-gray-50"><div className="text-center py-12">Loading...</div></main>;

  const accountsPath = isShared ? '/shared/accounts' : '/personal/accounts';

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{scopeLabel} Income</h1>
        {error && <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="bg-white border rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Add Income Entry</h2>
          {accounts.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Add a {scope} account first. <Link href={accountsPath} className="underline">Go to {scopeLabel} Accounts</Link>.
            </div>
          ) : (
            <form onSubmit={handleAddIncome} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
              <input className="px-3 py-2 border rounded-lg" value={newEntry.amount} onChange={(e) => setNewEntry((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount *" type="number" step="0.01" min="0" required />
              <input className="px-3 py-2 border rounded-lg" value={newEntry.received_date} onChange={(e) => setNewEntry((p) => ({ ...p, received_date: e.target.value }))} type="date" required />
              <select className="px-3 py-2 border rounded-lg" value={newEntry.account_id} onChange={(e) => setNewEntry((p) => ({ ...p, account_id: e.target.value }))}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <input className="px-3 py-2 border rounded-lg" value={newEntry.source} onChange={(e) => setNewEntry((p) => ({ ...p, source: e.target.value }))} placeholder="Source" />
              <input className="px-3 py-2 border rounded-lg" value={newEntry.tags} onChange={(e) => setNewEntry((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags: salary, rsu, espp, 401k, hsa" />
              <input className="px-3 py-2 border rounded-lg" value={newEntry.stock_symbol} onChange={(e) => setNewEntry((p) => ({ ...p, stock_symbol: e.target.value }))} placeholder="Stock symbol (optional)" />
              <input className="px-3 py-2 border rounded-lg" value={newEntry.stock_shares} onChange={(e) => setNewEntry((p) => ({ ...p, stock_shares: e.target.value }))} placeholder="Stock shares (optional)" type="number" step="0.000001" min="0" />
              <input className="px-3 py-2 border rounded-lg" value={newEntry.notes} onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
              <div className="sm:col-span-2 lg:col-span-8 flex justify-end"><button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white">{saving ? 'Saving...' : 'Add Income'}</button></div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm"><p className="text-sm text-gray-500">Total ({selectedYear})</p><p className="text-2xl font-bold">{formatCurrency(totalIncomeForYear)}</p></div>
          <div className="bg-white border rounded-xl p-4 shadow-sm"><p className="text-sm text-gray-500">Average Active Month</p><p className="text-2xl font-bold text-green-600">{formatCurrency(averageMonthlyIncome)}</p></div>
          <div className="bg-white border rounded-xl p-4 shadow-sm"><p className="text-sm text-gray-500">Entries</p><p className="text-2xl font-bold">{filteredEntries.length}</p></div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="">All tags</option>
              {tagTotals.map(([tag]) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            {tagTotals.slice(0, 6).map(([tag, total]) => <span key={tag} className="text-xs px-2 py-1 bg-gray-100 rounded-full">{tag}: {formatCurrency(total)}</span>)}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Income</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {MONTH_NAMES.map((monthName, index) => <div key={monthName} className="rounded-lg border p-3"><p className="text-xs text-gray-500">{monthName}</p><p className="text-sm font-semibold mt-1">{formatCurrency(monthlyTotals[index])}</p></div>)}
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-3 px-4">Date</th><th className="py-3 px-4">Tags</th><th className="py-3 px-4">Account</th><th className="py-3 px-4">Stock</th><th className="py-3 px-4">Source</th><th className="py-3 px-4">Notes</th><th className="py-3 px-4 text-right">Amount</th><th className="py-3 px-4 text-right">Actions</th></tr></thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const isEditing = editingId === entry.id;
                return (
                  <tr key={entry.id} className="border-b">
                    <td className="py-3 px-4">{isEditing ? <input type="date" value={editEntry.received_date} onChange={(e) => setEditEntry((p) => ({ ...p, received_date: e.target.value }))} className="px-2 py-1 border rounded" /> : formatDate(entry.received_date)}</td>
                    <td className="py-3 px-4">{isEditing ? <input value={editEntry.tags} onChange={(e) => setEditEntry((p) => ({ ...p, tags: e.target.value }))} className="px-2 py-1 border rounded w-48" /> : getEntryTags(entry).join(', ')}</td>
                    <td className="py-3 px-4">{isEditing ? <select value={editEntry.account_id} onChange={(e) => setEditEntry((p) => ({ ...p, account_id: e.target.value }))} className="px-2 py-1 border rounded">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select> : (accountNameById[entry.account_id] || 'Unknown')}</td>
                    <td className="py-3 px-4">{entry.stock_symbol ? `${entry.stock_symbol} (${entry.stock_shares})` : '-'}</td>
                    <td className="py-3 px-4">{isEditing ? <input value={editEntry.source} onChange={(e) => setEditEntry((p) => ({ ...p, source: e.target.value }))} className="px-2 py-1 border rounded" /> : (entry.source || '-')}</td>
                    <td className="py-3 px-4">{isEditing ? <input value={editEntry.notes} onChange={(e) => setEditEntry((p) => ({ ...p, notes: e.target.value }))} className="px-2 py-1 border rounded" /> : (entry.notes || '-')}</td>
                    <td className="py-3 px-4 text-right">{isEditing ? <input type="number" value={editEntry.amount} onChange={(e) => setEditEntry((p) => ({ ...p, amount: e.target.value }))} className="px-2 py-1 border rounded w-24 text-right" step="0.01" min="0" /> : formatCurrency(Number(entry.amount))}</td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <><button onClick={() => handleSaveEdit(entry.id)} disabled={savingEdit} className="px-3 py-1 rounded bg-green-600 text-white mr-2">Save</button><button onClick={cancelEdit} className="px-3 py-1 rounded bg-gray-200">Cancel</button></>
                      ) : (
                        <><button onClick={() => beginEdit(entry)} className="px-3 py-1 rounded bg-blue-600 text-white mr-2">Edit</button><button onClick={() => handleDelete(entry)} disabled={deletingId === entry.id} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button></>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
