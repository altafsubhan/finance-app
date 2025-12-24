'use client';

import { useState, useEffect } from 'react';
import { Category, CategoryType } from '@/types/database';

interface BudgetFormProps {
  categories: Category[];
  year: number;
  onSuccess: () => void;
  initialData?: {
    id: string;
    category_id: string;
    period: 'month' | 'quarter' | 'year';
    period_value: number | null;
    amount: number;
  } | null;
}

export default function BudgetForm({ categories, year, onSuccess, initialData }: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('year');
  const [periodValue, setPeriodValue] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setCategoryId(initialData.category_id);
      setPeriod(initialData.period);
      setPeriodValue(initialData.period_value?.toString() || '');
      setAmount(initialData.amount.toString());
    } else if (categories.length > 0) {
      // Auto-select first category and match its type
      const firstCat = categories[0];
      setCategoryId(firstCat.id);
      setPeriod(firstCat.type === 'monthly' ? 'month' : firstCat.type === 'quarterly' ? 'quarter' : 'year');
    }
  }, [initialData, categories]);

  const selectedCategory = categories.find(c => c.id === categoryId);
  const categoryType = selectedCategory?.type || 'monthly';

  // Update period when category changes
  useEffect(() => {
    if (selectedCategory && !initialData) {
      if (selectedCategory.type === 'monthly') {
        setPeriod('month');
      } else if (selectedCategory.type === 'quarterly') {
        setPeriod('quarter');
      } else {
        setPeriod('year');
      }
    }
  }, [selectedCategory, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = initialData 
        ? `/api/budgets/${initialData.id}`
        : '/api/budgets';
      
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category_id: categoryId,
          year,
          period,
          period_value: periodValue ? parseInt(periodValue) : null,
          amount: parseFloat(amount),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save budget');
      }

      // Reset form if new budget
      if (!initialData) {
        setAmount('');
        setPeriodValue('');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Category *
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            disabled={!!initialData}
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="period" className="block text-sm font-medium mb-1">
            Period *
          </label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')}
            required
            disabled={!!initialData}
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Yearly</option>
          </select>
        </div>

        {period === 'month' && (
          <div>
            <label htmlFor="period_value" className="block text-sm font-medium mb-1">
              Month (1-12)
            </label>
            <select
              id="period_value"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        )}

        {period === 'quarter' && (
          <div>
            <label htmlFor="period_value" className="block text-sm font-medium mb-1">
              Quarter (1-4)
            </label>
            <select
              id="period_value"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Quarters</option>
              <option value="1">Q1 (Jan-Mar)</option>
              <option value="2">Q2 (Apr-Jun)</option>
              <option value="3">Q3 (Jul-Sep)</option>
              <option value="4">Q4 (Oct-Dec)</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">
            Budget Amount *
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : initialData ? 'Update Budget' : 'Create Budget'}
      </button>
    </form>
  );
}

