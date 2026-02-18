'use client';

import { useEffect, useState } from 'react';

export default function BalanceAutomationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/preferences', { credentials: 'include' });
        if (!res.ok) {
          const payload = await res.json();
          throw new Error(payload.error || 'Failed to load preferences');
        }

        const data = await res.json();
        setEnabled(Boolean(data.auto_adjust_balances_from_income));
      } catch (loadError: any) {
        console.error('Failed to load balance automation preference:', loadError);
        setError(loadError?.message || 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, []);

  const handleToggle = async (nextValue: boolean) => {
    const previousValue = enabled;
    setEnabled(nextValue);
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          auto_adjust_balances_from_income: nextValue,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Failed to save preferences');
      }
    } catch (saveError: any) {
      console.error('Failed to save balance automation preference:', saveError);
      setEnabled(previousValue);
      setError(saveError?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border rounded-lg p-6 space-y-3 md:col-span-2">
      <div>
        <h2 className="text-xl font-semibold">Account Balance Automation</h2>
        <p className="text-sm text-gray-600 mt-1">
          Automatically apply new income entries as unrecorded adjustments after your latest manual
          balance snapshot. Income dated on or before that snapshot is ignored.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            disabled={loading || saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-800">
            Enable income-based balance auto-adjustments
          </span>
        </label>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <p className="text-xs text-gray-500">
        Manual balance updates are still available anytime and remain the baseline for future
        auto-adjustments.
      </p>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
    </section>
  );
}
