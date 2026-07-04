'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Category } from '@/types/database';
import PlaidLinkButton, { PlaidLinkProvider } from '@/components/PlaidLinkButton';

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

type SortField = 'date' | 'description' | 'amount' | 'category' | 'scope' | 'payment_method';
type SortDirection = 'asc' | 'desc';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set<string>();
    items.forEach((item) => {
      if (item.payment_method) methods.add(item.payment_method);
    });
    return Array.from(methods).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const getCategoryName = useCallback(
    (categoryId: string | null) => {
      if (!categoryId) return 'Uncategorized';
      return categoriesById.get(categoryId)?.name || 'Uncategorized';
    },
    [categoriesById]
  );

  const getDescription = (item: InboxItem) =>
    item.description || item.merchant_name || '';

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter === 'uncategorized' && item.suggested_category_id) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'uncategorized') {
        if (item.suggested_category_id !== categoryFilter) return false;
      }
      if (scopeFilter === 'shared' && !item.is_shared) return false;
      if (scopeFilter === 'personal' && item.is_shared) return false;
      if (paymentMethodFilter !== 'all' && item.payment_method !== paymentMethodFilter) return false;

      if (!query) return true;

      const haystack = [
        getDescription(item),
        item.merchant_name || '',
        getCategoryName(item.suggested_category_id),
        item.payment_method || '',
        item.date || '',
        Math.abs(Number(item.amount)).toString(),
        formatCurrency(Math.abs(Number(item.amount))),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, searchQuery, categoryFilter, scopeFilter, paymentMethodFilter, getCategoryName]);

  const visibleItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'date':
          aValue = a.date ? new Date(a.date).getTime() : 0;
          bValue = b.date ? new Date(b.date).getTime() : 0;
          break;
        case 'description':
          aValue = getDescription(a).toLowerCase();
          bValue = getDescription(b).toLowerCase();
          break;
        case 'amount':
          aValue = Math.abs(Number(a.amount));
          bValue = Math.abs(Number(b.amount));
          break;
        case 'category':
          aValue = getCategoryName(a.suggested_category_id).toLowerCase();
          bValue = getCategoryName(b.suggested_category_id).toLowerCase();
          break;
        case 'scope':
          aValue = a.is_shared ? 'shared' : 'personal';
          bValue = b.is_shared ? 'shared' : 'personal';
          break;
        case 'payment_method':
          aValue = (a.payment_method || '').toLowerCase();
          bValue = (b.payment_method || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection, getCategoryName]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    scopeFilter !== 'all' ||
    paymentMethodFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setScopeFilter('all');
    setPaymentMethodFilter('all');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({
    field,
    align = 'left',
    children,
  }: {
    field: SortField;
    align?: 'left' | 'right' | 'center';
    children: ReactNode;
  }) => (
    <th
      className={`px-3 py-2 text-xs font-medium text-gray-500 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 ${
          align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''
        }`}
      >
        {children}
        {sortField === field && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );

  const allSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selected.has(item.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
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
      // keep scope aligned with the category's scope; default back to shared when cleared
      is_shared: cat ? cat.is_shared : true,
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
    <PlaidLinkProvider onLinked={loadAll}>
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
            <PlaidLinkButton />
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
                  <div className="mt-2">
                    <PlaidLinkButton
                      plaidItemId={li.id}
                      label="Add accounts"
                      className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && items.length > 0 && (
          <div className="border rounded-lg p-4 bg-white space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex-1 min-w-[220px]">
                  <label htmlFor="inbox-search" className="block text-xs font-medium text-gray-500 mb-1">
                    Search
                  </label>
                  <input
                    id="inbox-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Description, category, method, amount..."
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="min-w-[180px]">
                  <label htmlFor="inbox-category-filter" className="block text-xs font-medium text-gray-500 mb-1">
                    Category
                  </label>
                  <select
                    id="inbox-category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                  >
                    <option value="all">All categories</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.is_shared ? 'S' : 'P'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[140px]">
                  <label htmlFor="inbox-scope-filter" className="block text-xs font-medium text-gray-500 mb-1">
                    Scope
                  </label>
                  <select
                    id="inbox-scope-filter"
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value as 'all' | 'shared' | 'personal')}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                  >
                    <option value="all">All scopes</option>
                    <option value="shared">Shared</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                {paymentMethodOptions.length > 0 && (
                  <div className="min-w-[160px]">
                    <label htmlFor="inbox-method-filter" className="block text-xs font-medium text-gray-500 mb-1">
                      Payment method
                    </label>
                    <select
                      id="inbox-method-filter"
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                    >
                      <option value="all">All methods</option>
                      {paymentMethodOptions.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>
                  {hasActiveFilters
                    ? `Showing ${visibleItems.length} of ${items.length}`
                    : `${items.length} total`}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {!loading && visibleItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4" />
            Select all ({visibleItems.length})
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
        )}

        {/* Pending list */}
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-gray-500">
            Nothing to review. Link a bank or hit “Refresh from banks” to pull in new transactions.
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-gray-500">
            No transactions match your filters.
            {hasActiveFilters && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-[820px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <SortHeader field="date">Date</SortHeader>
                  <SortHeader field="description">Description</SortHeader>
                  <SortHeader field="amount" align="right">Amount</SortHeader>
                  <SortHeader field="category">Category</SortHeader>
                  <SortHeader field="scope" align="center">Scope</SortHeader>
                  <SortHeader field="payment_method">Method</SortHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleItems.map((item) => (
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
    </PlaidLinkProvider>
  );
}
