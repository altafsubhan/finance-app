'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Category } from '@/types/database';
import PlaidLinkButton from '@/components/PlaidLinkButton';

interface InboxItem {
  id: string;
  source: string;
  status: string;
  date: string | null;
  amount: number;
  description: string;
  merchant_name: string | null;
  suggested_category_id: string | null;
  payment_method: string | null;
  is_shared: boolean;
  is_pending: boolean;
}

interface LinkedAccount {
  id: string;
  name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
}

interface LinkedItem {
  id: string;
  institution_name: string | null;
  status: string;
  last_synced_at: string | null;
  accounts: LinkedAccount[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, catRes, itemsRes] = await Promise.all([
        fetch('/api/inbox?status=pending', { credentials: 'include' }),
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/plaid/items', { credentials: 'include' }),
      ]);
      const inbox = await inboxRes.json();
      const cats = await catRes.json();
      const linked = await itemsRes.json();
      setItems(inbox.items || []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLinkedItems(linked.items || []);
      setSelected(new Set());
    } catch {
      setError('Failed to load the inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const allSelected = items.length > 0 && selected.size === items.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const patchItem = async (id: string, patch: Partial<InboxItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    await fetch(`/api/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
  };

  const onChangeCategory = (item: InboxItem, categoryId: string) => {
    const cat = categoryId ? categoriesById.get(categoryId) : null;
    patchItem(item.id, {
      suggested_category_id: categoryId || null,
      // keep scope aligned with the category's scope, like the rest of the app
      ...(cat ? { is_shared: cat.is_shared } : {}),
    });
  };

  const refreshFromBanks = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sync failed.');
      } else {
        setMessage(`Synced ${data.items} linked source(s); ${data.added} new transaction(s) found.`);
        await loadAll();
      }
    } catch {
      setError('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const approveSelected = async () => {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    const res = await fetch('/api/inbox/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Approve failed.');
      return;
    }
    setMessage(`Approved ${data.created} transaction(s).`);
    await loadAll();
  };

  const dismissSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await fetch('/api/inbox/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids }),
    });
    setMessage(`Dismissed ${ids.length} item(s).`);
    await loadAll();
  };

  const unlink = async (id: string) => {
    if (!confirm('Unlink this institution? Already-approved transactions are kept.')) return;
    await fetch('/api/plaid/items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    });
    await loadAll();
  };

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Review Inbox</h1>
            <p className="text-gray-600 text-sm mt-1">
              New transactions from your linked banks land here. Only you can see your inbox and linked accounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshFromBanks}
              disabled={syncing}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50"
            >
              {syncing ? 'Refreshing…' : 'Refresh from banks'}
            </button>
            <PlaidLinkButton onLinked={loadAll} />
          </div>
        </div>

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Linked institutions */}
        {linkedItems.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm font-medium text-gray-700 mb-2">Linked accounts</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {linkedItems.map((li) => (
                <div key={li.id} className="bg-white border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">
                      {li.institution_name || 'Institution'}
                    </div>
                    <button
                      onClick={() => unlink(li.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Unlink
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {li.accounts.map((a) => `${a.name || a.subtype || 'Account'}${a.mask ? ` ••${a.mask}` : ''}`).join(', ') || 'No accounts'}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {li.status !== 'active' ? `Status: ${li.status} · ` : ''}
                    {li.last_synced_at ? `Synced ${new Date(li.last_synced_at).toLocaleString()}` : 'Not synced yet'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bulk actions */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4" />
            Select all ({items.length})
          </label>
          <button
            onClick={approveSelected}
            disabled={selected.size === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Approve {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
          <button
            onClick={dismissSelected}
            disabled={selected.size === 0}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Dismiss {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>

        {/* Pending list */}
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-gray-500">
            Nothing to review. Link a bank or hit “Refresh from banks” to pull in new transactions.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-[820px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Scope</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className={selected.has(item.id) ? 'bg-blue-50' : ''}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                      {item.date || '—'}
                      {item.is_pending && (
                        <span className="ml-1 text-[10px] text-amber-600">pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {item.description || item.merchant_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
                      {formatCurrency(Math.abs(Number(item.amount)))}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <select
                        value={item.suggested_category_id || ''}
                        onChange={(e) => onChangeCategory(item, e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-white"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.is_shared ? 'S' : 'P'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => patchItem(item.id, { is_shared: !item.is_shared })}
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          item.is_shared
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {item.is_shared ? 'Shared' : 'Personal'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                      {item.payment_method || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
