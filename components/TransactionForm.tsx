'use client';

import { useState, useEffect } from 'react';
import { PaymentMethod, PaidBy, Category } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { format } from 'date-fns';

interface TransactionFormProps {
  categories: Category[];
  onSuccess: () => void;
  initialData?: {
    id: string;
    date: string | null;
    amount: number;
    description: string;
    category_id: string | null; // Allow null for uncategorized transactions
    payment_method: PaymentMethod;
    paid_by: PaidBy;
    month: number | null;
    quarter: number | null;
    year: number;
  } | null;
}

export default function TransactionForm({ categories, onSuccess, initialData }: TransactionFormProps) {
  const { paymentMethods } = usePaymentMethods();
  const currentDate = new Date();
  const [date, setDate] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paidBy, setPaidBy] = useState<PaidBy>(null);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [periodValue, setPeriodValue] = useState<number | ''>(currentDate.getMonth() + 1);
  const [autoDetectPeriod, setAutoDetectPeriod] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect period type from category when toggle is on
  useEffect(() => {
    if (autoDetectPeriod && categoryId) {
      const selectedCategory = categories.find(c => c.id === categoryId);
      if (selectedCategory) {
        if (selectedCategory.type === 'monthly') {
          setPeriodType('month');
          if (!periodValue) {
            setPeriodValue(currentDate.getMonth() + 1);
          }
        } else if (selectedCategory.type === 'quarterly') {
          setPeriodType('quarter');
          if (!periodValue) {
            setPeriodValue(Math.ceil((currentDate.getMonth() + 1) / 3));
          }
        } else if (selectedCategory.type === 'yearly') {
          setPeriodType('year');
          setPeriodValue('');
        }
      }
    }
  }, [categoryId, autoDetectPeriod, categories, currentDate, periodValue]);

  useEffect(() => {
    if (initialData) {
      setDate(initialData.date || '');
      setAmount(initialData.amount.toString());
      setDescription(initialData.description);
      setCategoryId(initialData.category_id || ''); // Handle null category_id
      setPaymentMethod(initialData.payment_method);
      setPaidBy(initialData.paid_by);
      setYear(initialData.year);
      
      // Determine period type from existing data
      if (initialData.month) {
        setPeriodType('month');
        setPeriodValue(initialData.month);
      } else if (initialData.quarter) {
        setPeriodType('quarter');
        setPeriodValue(initialData.quarter);
      } else {
        setPeriodType('year');
        setPeriodValue('');
      }
    }
  }, [initialData]);

  // Normalize date - for DATE type in PostgreSQL, we should send YYYY-MM-DD as-is
  // HTML date inputs return YYYY-MM-DD format which is perfect for DATE columns
  const normalizeDateForAPI = (dateString: string | null): string | null => {
    if (!dateString) return null;
    
    // If date includes time (T), extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    
    // Validate it's in YYYY-MM-DD format and return as-is
    // This avoids any timezone conversion issues since DATE type doesn't have timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = initialData 
        ? `/api/transactions/${initialData.id}`
        : '/api/transactions';
      
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: normalizeDateForAPI(date),
          amount: parseFloat(amount),
          description,
          category_id: categoryId || null, // Allow null/empty category_id
          payment_method: paymentMethod,
          paid_by: paidBy,
          year,
          month: periodType === 'month' ? (periodValue ? parseInt(periodValue.toString()) : null) : null,
          quarter: periodType === 'quarter' ? (periodValue ? parseInt(periodValue.toString()) : null) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save transaction');
      }

      // Reset form
      if (!initialData) {
        setDate('');
        setAmount('');
        setDescription('');
        setCategoryId('');
        setPaymentMethod('Cash');
        setPaidBy(null);
        setYear(currentDate.getFullYear());
        setPeriodType('month');
        setPeriodValue(currentDate.getMonth() + 1);
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
          <label htmlFor="year" className="block text-sm font-medium mb-1">
            Year *
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            required
            min="2000"
            max="2100"
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="period_type" className="block text-sm font-medium">
              Period Type *
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={autoDetectPeriod}
                onChange={(e) => setAutoDetectPeriod(e.target.checked)}
                className="rounded"
              />
              Auto-detect from category
            </label>
          </div>
          <select
            id="period_type"
            value={periodType}
            onChange={(e) => {
              setPeriodType(e.target.value as 'month' | 'quarter' | 'year');
              // Reset period value when type changes
              if (e.target.value === 'year') {
                setPeriodValue('');
              } else if (e.target.value === 'month' && !periodValue) {
                setPeriodValue(currentDate.getMonth() + 1);
              } else if (e.target.value === 'quarter' && !periodValue) {
                setPeriodValue(Math.ceil((currentDate.getMonth() + 1) / 3));
              }
            }}
            required
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div>
          <label htmlFor="period_value" className="block text-sm font-medium mb-1">
            {periodType === 'month' ? 'Month *' : periodType === 'quarter' ? 'Quarter *' : 'Year'}
          </label>
          {periodType === 'month' ? (
            <select
              id="period_value"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value ? parseInt(e.target.value) : '')}
              required
              className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Month</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          ) : periodType === 'quarter' ? (
            <select
              id="period_value"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value ? parseInt(e.target.value) : '')}
              required
              className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Quarter</option>
              <option value="1">Q1 (January - March)</option>
              <option value="2">Q2 (April - June)</option>
              <option value="3">Q3 (July - September)</option>
              <option value="4">Q4 (October - December)</option>
            </select>
          ) : (
            <input
              id="period_value"
              type="text"
              value="Full Year"
              disabled
              className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          )}
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-1">
            Date (Optional)
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">
            Amount *
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

        <div className="md:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description *
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Category (Optional)
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="payment_method" className="block text-sm font-medium mb-1">
            Payment Method *
          </label>
          <select
            id="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            required
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.name}>
                {method.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="paid_by" className="block text-sm font-medium mb-1">
            Paid By
          </label>
          <select
            id="paid_by"
            value={paidBy || ''}
            onChange={(e) => setPaidBy(e.target.value as PaidBy || null)}
            className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAID_BY_OPTIONS.map((option) => (
              <option key={option.value || 'null'} value={option.value || ''}>
                {option.label}
              </option>
            ))}
          </select>
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
        {loading ? 'Saving...' : initialData ? 'Update Transaction' : 'Add Transaction'}
      </button>
    </form>
  );
}

