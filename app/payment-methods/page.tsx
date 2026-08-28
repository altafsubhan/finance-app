'use client';

import { useState, useEffect } from 'react';

interface PaymentMethod {
  id: string;
  name: string;
  is_shared?: boolean;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface PlaidAccount {
  id: string;
  plaid_item_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  payment_method_id: string | null;
  institution_name?: string | null;
}

interface RemapPreview {
  accountId: string;
  oldPmName: string | null;
  newPmId: string;
  transactionCount: number;
  inboxCount: number;
  loading: boolean;
}

const FIELD = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remap state: accountId → selected new PM id
  const [remapSelections, setRemapSelections] = useState<Record<string, string>>({});
  const [remapPreview, setRemapPreview] = useState<RemapPreview | null>(null);
  const [remapBackfill, setRemapBackfill] = useState(true);
  const [remapSaving, setRemapSaving] = useState(false);
  const [remapSuccess, setRemapSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pmRes, itemsRes] = await Promise.all([
        fetch('/api/payment-methods', { credentials: 'include' }),
        fetch('/api/plaid/items', { credentials: 'include' }),
      ]);
      if (pmRes.ok) setPaymentMethods(await pmRes.json());
      if (itemsRes.ok) {
        const { items } = await itemsRes.json();
        const accounts: PlaidAccount[] = [];
        for (const item of (items || [])) {
          for (const acc of (item.accounts || [])) {
            accounts.push({ ...acc, institution_name: item.institution_name });
          }
        }
        setPlaidAccounts(accounts);
        // Pre-populate remap selections with current payment_method_id
        const initial: Record<string, string> = {};
        for (const acc of accounts) {
          if (acc.payment_method_id) initial[acc.id] = acc.payment_method_id;
        }
        setRemapSelections(initial);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Name is required'); return; }
    try {
      setAdding(true);
      setError(null);
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) { setNewName(''); await loadAll(); }
      else setError((await res.json()).error || 'Failed to add payment method');
    } catch { setError('Failed to add payment method'); }
    finally { setAdding(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) { setError('Name is required'); return; }
    try {
      setError(null);
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) { setEditingId(null); setEditName(''); await loadAll(); }
      else setError((await res.json()).error || 'Failed to update');
    } catch { setError('Failed to update payment method'); }
  };

  const handleToggleShared = async (pm: PaymentMethod) => {
    setPaymentMethods((prev) => prev.map((p) => p.id === pm.id ? { ...p, is_shared: !pm.is_shared } : p));
    try {
      const res = await fetch(`/api/payment-methods/${pm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_shared: !pm.is_shared }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Failed to update'); await loadAll(); }
    } catch { setError('Failed to update'); await loadAll(); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Cannot be undone.`)) return;
    try {
      setError(null);
      const res = await fetch(`/api/payment-methods/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) await loadAll();
      else { const d = await res.json(); setError(d.error || 'Failed to delete'); alert(d.error || 'Failed to delete'); }
    } catch { setError('Failed to delete payment method'); }
  };

  // Remap helpers
  const handleRemapSelectionChange = async (accountId: string, newPmId: string) => {
    setRemapSelections((prev) => ({ ...prev, [accountId]: newPmId }));
    setRemapPreview(null);
    setRemapSuccess(null);
    if (!newPmId) return;

    // Fetch preview count
    setRemapPreview({ accountId, oldPmName: null, newPmId, transactionCount: 0, inboxCount: 0, loading: true });
    try {
      const res = await fetch(`/api/plaid/accounts/${accountId}/remap?new_payment_method_id=${newPmId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRemapPreview({ accountId, oldPmName: data.oldPmName, newPmId, transactionCount: data.transactionCount, inboxCount: data.inboxCount, loading: false });
      } else {
        setRemapPreview(null);
      }
    } catch {
      setRemapPreview(null);
    }
  };

  const handleApplyRemap = async (accountId: string) => {
    const newPmId = remapSelections[accountId];
    if (!newPmId) return;
    setRemapSaving(true);
    setRemapSuccess(null);
    try {
      const res = await fetch(`/api/plaid/accounts/${accountId}/remap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_method_id: newPmId, backfill: remapBackfill }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg = data.backfilled && (data.updatedTransactions + data.updatedInbox) > 0
          ? `Remapped to "${data.newPaymentMethod}". Updated ${data.updatedTransactions} transaction${data.updatedTransactions !== 1 ? 's' : ''} and ${data.updatedInbox} inbox item${data.updatedInbox !== 1 ? 's' : ''}.`
          : `Remapped to "${data.newPaymentMethod}". Future syncs will use this mapping.`;
        setRemapSuccess(msg);
        setRemapPreview(null);
        await loadAll();
      } else {
        setError((await res.json()).error || 'Remap failed');
      }
    } catch { setError('Remap failed'); }
    finally { setRemapSaving(false); }
  };

  const getAccountLabel = (acc: PlaidAccount) => {
    const base = acc.official_name || acc.name || acc.subtype || 'Account';
    const mask = acc.mask ? ` ••${acc.mask}` : '';
    return `${base}${mask}`;
  };

  const getCurrentPm = (acc: PlaidAccount) =>
    paymentMethods.find((pm) => pm.id === acc.payment_method_id) ?? null;

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto"><div className="text-center py-12 text-gray-500">Loading…</div></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your payment methods and reconcile Plaid bank accounts.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {remapSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{remapSuccess}</div>
        )}

        {/* ── Add New ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Add Payment Method</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="e.g. WF Autograph"
              className={FIELD}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        {/* ── Payment Methods List ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Your Payment Methods</h2>
          </div>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">No payment methods yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  {editingId === pm.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(pm.id); else if (e.key === 'Escape') { setEditingId(null); setEditName(''); }}}
                        className={FIELD}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(pm.id)} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Save</button>
                      <button onClick={() => { setEditingId(null); setEditName(''); }} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 truncate">{pm.name}</span>
                        {pm.is_shared && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 flex-shrink-0">Shared</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={Boolean(pm.is_shared)} onChange={() => handleToggleShared(pm)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="hidden sm:inline">Shared card</span>
                        </label>
                        <button onClick={() => { setEditingId(pm.id); setEditName(pm.name); setError(null); }} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</button>
                        <button onClick={() => handleDelete(pm.id, pm.name)} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Linked Bank Accounts (Plaid Reconciliation) ── */}
        {plaidAccounts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Linked Bank Accounts</h2>
              <p className="text-sm text-gray-500 mt-1">
                Map each Plaid account to the payment method name you use in your expenses.
                Remapping lets you match a bank-imported name like &ldquo;WELLS FARGO AUTOGRAPH VISA&rdquo; to your custom name &ldquo;WF Autograph&rdquo;.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {plaidAccounts.map((acc) => {
                const currentPm = getCurrentPm(acc);
                const selectedPmId = remapSelections[acc.id] || '';
                const selectedPm = paymentMethods.find((pm) => pm.id === selectedPmId);
                const hasChanged = selectedPmId && selectedPmId !== acc.payment_method_id;
                const preview = remapPreview?.accountId === acc.id ? remapPreview : null;

                return (
                  <div key={acc.id} className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Account info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{getAccountLabel(acc)}</span>
                          {acc.institution_name && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{acc.institution_name}</span>
                          )}
                          {acc.subtype && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 capitalize">{acc.subtype}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Currently mapped to: <span className="font-medium text-gray-700">{currentPm?.name ?? <span className="italic">None</span>}</span>
                        </p>
                      </div>

                      {/* Remap control */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          value={selectedPmId}
                          onChange={(e) => handleRemapSelectionChange(acc.id, e.target.value)}
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                        >
                          <option value="">— select payment method —</option>
                          {paymentMethods.map((pm) => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))}
                        </select>
                        {hasChanged && (
                          <button
                            onClick={() => handleApplyRemap(acc.id)}
                            disabled={remapSaving}
                            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {remapSaving ? 'Saving…' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview & backfill confirmation */}
                    {hasChanged && preview && !preview.loading && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm space-y-2">
                        {(preview.transactionCount + preview.inboxCount) > 0 ? (
                          <>
                            <p className="text-amber-800 font-medium">
                              {preview.transactionCount} past transaction{preview.transactionCount !== 1 ? 's' : ''} and {preview.inboxCount} inbox item{preview.inboxCount !== 1 ? 's' : ''} currently use &ldquo;{preview.oldPmName}&rdquo;.
                            </p>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={remapBackfill}
                                onChange={(e) => setRemapBackfill(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-amber-700">
                                Update all past transactions to use &ldquo;{selectedPm?.name}&rdquo; (recommended — prevents duplicates in filters)
                              </span>
                            </label>
                          </>
                        ) : (
                          <p className="text-gray-600">No past transactions to update. Future syncs will use &ldquo;{selectedPm?.name}&rdquo;.</p>
                        )}
                      </div>
                    )}
                    {hasChanged && preview?.loading && (
                      <p className="mt-2 text-xs text-gray-500">Checking transaction count…</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
