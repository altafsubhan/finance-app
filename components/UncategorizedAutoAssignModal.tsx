'use client';

import { useEffect, useMemo, useState } from 'react';
import { Category, CategoryRule, CategoryRuleBlocklist, Transaction } from '@/types/database';
import { suggestCategoryIdForDescription } from '@/lib/rules/categoryRules';

type ReviewRow = {
  id: string;
  transaction: Transaction;
  suggestedCategoryId: string | null;
  selectedCategoryId: string | null;
  selected: boolean;
  reason: string | null;
};

export default function UncategorizedAutoAssignModal(props: {
  isOpen: boolean;
  onClose: () => void;
  uncategorized: Transaction[];
  categories: Category[];
  rules: CategoryRule[];
  blocklist: CategoryRuleBlocklist[];
  onTransactionUpdated: (t: Transaction) => void;
}) {
  const { isOpen, onClose, uncategorized, categories, rules, blocklist, onTransactionUpdated } = props;

  const categoryOptions = useMemo(() => {
    return categories
      .slice()
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [categories]);

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const next = uncategorized.map((t) => {
      const suggestion = suggestCategoryIdForDescription({
        description: t.description,
        rules,
        blocklist,
        categories,
      });
      const suggestedCategoryId = suggestion?.category_id ?? null;
      return {
        id: t.id,
        transaction: t,
        suggestedCategoryId,
        selectedCategoryId: suggestedCategoryId,
        selected: !!suggestedCategoryId,
        reason: suggestion?.reason ?? null,
      };
    });
    setRows(next);
    setError(null);
  }, [isOpen, uncategorized, rules, blocklist, categories]);

  if (!isOpen) return null;

  const selectedCount = rows.filter(r => r.selected && r.selectedCategoryId).length;

  const applyUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const toApply = rows.filter(r => r.selected && r.selectedCategoryId);
      if (toApply.length === 0) {
        setError('Select at least one transaction with a category.');
        setLoading(false);
        return;
      }

      // Apply in small batches to avoid overwhelming the API
      const batchSize = 8;
      for (let i = 0; i < toApply.length; i += batchSize) {
        const batch = toApply.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (row) => {
            const res = await fetch(`/api/transactions/${row.transaction.id}/quick-update`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ category_id: row.selectedCategoryId }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || `Failed to update ${row.transaction.description}`);
            }
            return (await res.json()) as Transaction;
          })
        );
        results.forEach(onTransactionUpdated);
      }

      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to apply updates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 rounded-t-lg flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Auto-assign categories (uncategorized)</h2>
              <p className="text-sm text-gray-500 mt-1">
                Review suggestions from your rules, edit if needed, then apply.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-gray-700">
                {uncategorized.length} uncategorized transaction{uncategorized.length !== 1 ? 's' : ''} · {selectedCount} selected
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: !!r.selectedCategoryId })))}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Select suggested
                </button>
                <button
                  type="button"
                  onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-[950px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Apply</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[320px]">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-64">Suggested</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-64">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-sm text-gray-500">
                        No uncategorized transactions in the current list.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setRows(prev =>
                                prev.map(r =>
                                  r.id === row.id ? { ...r, selected: e.target.checked } : r
                                )
                              )
                            }
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          ${Math.abs(row.transaction.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.transaction.description}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {row.suggestedCategoryId ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {categories.find(c => c.id === row.suggestedCategoryId)?.name ?? 'Unknown'}
                              </span>
                              {row.reason && <span className="text-xs text-gray-500">{row.reason}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400">No suggestion</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.selectedCategoryId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              setRows(prev =>
                                prev.map(r =>
                                  r.id === row.id
                                    ? { ...r, selectedCategoryId: val, selected: r.selected || !!val }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select category</option>
                            {categoryOptions.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name} ({cat.type})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyUpdates}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Applying...' : `Apply ${selectedCount} updates`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


