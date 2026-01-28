'use client';

import { useEffect, useMemo, useState } from 'react';
import { Category, CategoryRule, CategoryRuleBlocklist, RuleMatchType } from '@/types/database';

type RulesResponse = { rules: CategoryRule[]; blocklist: CategoryRuleBlocklist[] };

const MATCH_TYPES: Array<{ value: RuleMatchType; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'regex', label: 'Regex' },
];

export default function RulesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [blocklist, setBlocklist] = useState<CategoryRuleBlocklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Rule form
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState<RuleMatchType>('contains');
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('');
  const [newRulePriority, setNewRulePriority] = useState(10);

  // Create Block form
  const [newBlockPattern, setNewBlockPattern] = useState('');
  const [newBlockMatchType, setNewBlockMatchType] = useState<RuleMatchType>('contains');
  const [newBlockReason, setNewBlockReason] = useState('Multi-category merchant; requires manual categorization');

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [categoriesRes, rulesRes] = await Promise.all([
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/category-rules', { credentials: 'include' }),
      ]);

      if (!categoriesRes.ok) throw new Error('Failed to load categories');
      if (!rulesRes.ok) throw new Error('Failed to load rules');

      const categoriesData = await categoriesRes.json();
      const rulesData: RulesResponse = await rulesRes.json();

      setCategories(categoriesData);
      setRules(rulesData.rules || []);
      setBlocklist(rulesData.blocklist || []);

      // helpful default: first monthly category
      if (!newRuleCategoryId && categoriesData.length > 0) {
        setNewRuleCategoryId(categoriesData[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRule = async () => {
    if (!newRulePattern.trim()) return setError('Rule pattern is required');
    if (!newRuleCategoryId) return setError('Rule category is required');

    setError(null);
    const res = await fetch('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        kind: 'rule',
        pattern: newRulePattern.trim(),
        match_type: newRuleMatchType,
        category_id: newRuleCategoryId,
        priority: newRulePriority,
        is_active: true,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create rule');
    }

    setNewRulePattern('');
    await loadAll();
  };

  const createBlock = async () => {
    if (!newBlockPattern.trim()) return setError('Blocklist pattern is required');
    setError(null);

    const res = await fetch('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        kind: 'block',
        pattern: newBlockPattern.trim(),
        match_type: newBlockMatchType,
        reason: newBlockReason || null,
        is_active: true,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create blocklist entry');
    }

    setNewBlockPattern('');
    await loadAll();
  };

  const toggleRuleActive = async (id: string, kind: 'rule' | 'block', isActive: boolean) => {
    setError(null);
    const res = await fetch(`/api/category-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kind, is_active: !isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update');
    }
    await loadAll();
  };

  const deleteItem = async (id: string, kind: 'rule' | 'block') => {
    if (!confirm('Delete this item?')) return;
    setError(null);
    const res = await fetch(`/api/category-rules/${id}?kind=${kind}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete');
    }
    await loadAll();
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold">Auto-Category Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Used during import when “Auto-select categories using rules” is enabled.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Create Rule */}
        <div className="bg-white border rounded-lg p-4 sm:p-6 space-y-3">
          <h2 className="text-lg font-semibold">Add rule</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newRulePattern}
              onChange={(e) => setNewRulePattern(e.target.value)}
              className="md:col-span-2 w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='Merchant pattern (e.g. "VOYAGER CAFE")'
            />
            <select
              value={newRuleMatchType}
              onChange={(e) => setNewRuleMatchType(e.target.value as RuleMatchType)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MATCH_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={newRulePriority}
              onChange={(e) => setNewRulePriority(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
              step={1}
              title="Lower number = higher priority"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={newRuleCategoryId}
              onChange={(e) => setNewRuleCategoryId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type})
                </option>
              ))}
            </select>
            <button
              onClick={() => createRule().catch((e: any) => setError(e.message))}
              className="md:col-span-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add rule
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Priority: lower number wins. Rules are skipped if a blocklist entry matches.
          </p>
        </div>

        {/* Rules List */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Rules</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pattern</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rules.length === 0 ? (
                  <tr><td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>No rules yet.</td></tr>
                ) : (
                  rules.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRuleActive(r.id, 'rule', r.is_active).catch((e: any) => setError(e.message))}
                          className={`px-2 py-1 text-xs rounded ${
                            r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r.is_active ? 'On' : 'Off'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.pattern}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.match_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {categoryById.get(r.category_id)?.name ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.priority}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteItem(r.id, 'rule').catch((e: any) => setError(e.message))}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Blocklist */}
        <div className="bg-white border rounded-lg p-4 sm:p-6 space-y-3">
          <h2 className="text-lg font-semibold">Blocklist (never auto-assign)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newBlockPattern}
              onChange={(e) => setNewBlockPattern(e.target.value)}
              className="md:col-span-2 w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='Pattern (e.g. "AMAZON")'
            />
            <select
              value={newBlockMatchType}
              onChange={(e) => setNewBlockMatchType(e.target.value as RuleMatchType)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MATCH_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => createBlock().catch((e: any) => setError(e.message))}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Add block
            </button>
          </div>
          <input
            value={newBlockReason}
            onChange={(e) => setNewBlockReason(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Reason (optional)"
          />

          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-[700px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pattern</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {blocklist.length === 0 ? (
                  <tr><td className="px-4 py-6 text-sm text-gray-500" colSpan={5}>No blocklist entries.</td></tr>
                ) : (
                  blocklist.map(b => (
                    <tr key={b.id}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRuleActive(b.id, 'block', b.is_active).catch((e: any) => setError(e.message))}
                          className={`px-2 py-1 text-xs rounded ${
                            b.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {b.is_active ? 'On' : 'Off'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{b.pattern}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{b.match_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{b.reason ?? ''}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteItem(b.id, 'block').catch((e: any) => setError(e.message))}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}


