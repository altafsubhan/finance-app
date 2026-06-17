'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Member {
  id: string;
  label: string;
}

interface LedgerItem {
  id: string;
  date: string | null;
  amount: number;
  payment_method: string;
  is_shared: boolean;
  claim_status: string;
  attributed_to: string | null;
  attributed_to_label: string | null;
  owner_is_me: boolean;
  redacted: boolean;
  status: 'shared' | 'personal_mine' | 'personal_partner' | 'unassigned';
  description: string | null;
  category: string | null;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const statusBadge = (item: LedgerItem) => {
  switch (item.status) {
    case 'shared':
      return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Shared (joint)</span>;
    case 'personal_mine':
      return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">My personal</span>;
    case 'personal_partner':
      return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">Accounted · {item.attributed_to_label}</span>;
    default:
      return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">Needs review</span>;
  }
};

export default function ReconcilePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [hasSharedCards, setHasSharedCards] = useState(true);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/transactions/shared-card-ledger?year=${year}&month=${month}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load.');
        return;
      }
      setItems(data.items || []);
      setMembers(data.members || []);
      setHasSharedCards((data.sharedCardNames || []).length > 0);
    } catch {
      setError('Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (item: LedgerItem, value: string) => {
    const patch =
      value === 'shared'
        ? { is_shared: true, attributed_to: null, claim_status: 'claimed' }
        : { is_shared: false, attributed_to: value, claim_status: 'claimed', details_private: true };
    const res = await fetch(`/api/transactions/${item.id}/quick-update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Update failed.');
      return;
    }
    await load();
  };

  const visible = useMemo(
    () => (onlyNeedsReview ? items.filter((i) => i.status === 'unassigned') : items),
    [items, onlyNeedsReview]
  );

  const byCard = useMemo(() => {
    const m = new Map<string, LedgerItem[]>();
    for (const it of visible) {
      if (!m.has(it.payment_method)) m.set(it.payment_method, []);
      m.get(it.payment_method)!.push(it);
    }
    return Array.from(m.entries());
  }, [visible]);

  const totals = useMemo(() => {
    const t = { shared: 0, mine: 0, partner: 0, unassigned: 0 };
    for (const i of items) {
      if (i.status === 'shared') t.shared += i.amount;
      else if (i.status === 'personal_mine') t.mine += i.amount;
      else if (i.status === 'personal_partner') t.partner += i.amount;
      else t.unassigned += i.amount;
    }
    return t;
  }, [items]);

  const selectValue = (item: LedgerItem) => (item.is_shared ? 'shared' : item.attributed_to || '');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Shared Card Reconciliation</h1>
          <p className="text-gray-600 text-sm mt-1">
            Every charge on your jointly used cards. Your partner&apos;s personal charges show as
            &ldquo;Accounted&rdquo; so you know they&apos;re already tracked - without exposing the details.
          </p>
        </div>

        {/* Period + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg bg-white text-sm"
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-24 px-3 py-2 border rounded-lg bg-white text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={onlyNeedsReview}
              onChange={(e) => setOnlyNeedsReview(e.target.checked)}
              className="w-4 h-4"
            />
            Only needs review
          </label>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="text-xs text-blue-700">Shared (joint)</div>
            <div className="text-lg font-semibold text-blue-900">{formatCurrency(totals.shared)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
            <div className="text-xs text-purple-700">My personal</div>
            <div className="text-lg font-semibold text-purple-900">{formatCurrency(totals.mine)}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <div className="text-xs text-emerald-700">Partner personal (accounted)</div>
            <div className="text-lg font-semibold text-emerald-900">{formatCurrency(totals.partner)}</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <div className="text-xs text-amber-700">Needs review</div>
            <div className="text-lg font-semibold text-amber-900">{formatCurrency(totals.unassigned)}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {!hasSharedCards ? (
          <div className="border rounded-lg p-8 text-center text-gray-500">
            No shared cards yet. Mark a payment method as shared in Settings to use reconciliation.
          </div>
        ) : loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : byCard.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-gray-500">
            No charges on shared cards for this period.
          </div>
        ) : (
          <div className="space-y-6">
            {byCard.map(([card, rows]) => (
              <div key={card} className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 font-medium text-gray-800">{card}</div>
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Assign to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{item.date || '—'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {item.redacted ? (
                              <span className="italic text-gray-400">Personal (private)</span>
                            ) : (
                              <>
                                {item.description || '—'}
                                {item.category && (
                                  <span className="ml-2 text-xs text-gray-400">{item.category}</span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-3 py-2">{statusBadge(item)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={selectValue(item)}
                              onChange={(e) => assign(item, e.target.value)}
                              className="px-2 py-1 text-sm border rounded bg-white"
                            >
                              <option value="shared">Shared (joint)</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  Personal · {m.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
