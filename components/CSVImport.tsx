'use client';

import { useState } from 'react';
import { Category, PaymentMethod } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';

interface CSVImportProps {
  categories: Category[];
  onSuccess: () => void;
}

interface ParsedTransaction {
  id: string;
  date: string;
  amount: string;
  description: string;
  category: string;
  payment_method: string;
  paid_by: string | null;
  year?: number;
  month?: number;
  quarter?: number;
}

export default function CSVImport({ categories, onSuccess }: CSVImportProps) {
  const { paymentMethods } = usePaymentMethods();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethodOverride, setPaymentMethodOverride] = useState<PaymentMethod | ''>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [periodValue, setPeriodValue] = useState<number>(new Date().getMonth() + 1);
  const [mapping, setMapping] = useState<{
    date: string;
    amount: string;
    description: string;
    category: string;
    payment_method: string;
    paid_by: string;
  }>({
    date: '',
    amount: '',
    description: '',
    category: '',
    payment_method: '',
    paid_by: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setError(null);
    }
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    const rows: string[][] = [];
    
    for (const line of lines) {
      // Simple CSV parser (handles quoted fields)
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      rows.push(row);
    }
    
    return rows;
  };

  const handlePreview = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          setError('CSV file must have at least a header row and one data row');
          return;
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        
        // Try to auto-detect column mapping
        const autoMapping = {
          date: headers.findIndex(h => h.includes('date')),
          amount: headers.findIndex(h => h.includes('amount') || h.includes('price') || h.includes('cost')),
          description: headers.findIndex(h => h.includes('description') || h.includes('note') || h.includes('memo') || h.includes('details')),
          category: headers.findIndex(h => h.includes('category') || h.includes('type')),
          payment_method: headers.findIndex(h => h.includes('payment') || h.includes('method') || h.includes('card')),
          paid_by: headers.findIndex(h => h.includes('paid') || h.includes('who')),
        };

        // Set mapping to header names (auto-detected, can be adjusted later with UI if needed)
        setMapping({
          date: headers[autoMapping.date] || headers[0] || '',
          amount: headers[autoMapping.amount] || headers[1] || '',
          description: headers[autoMapping.description] || headers[2] || '',
          category: headers[autoMapping.category] || '',
          payment_method: headers[autoMapping.payment_method] || '',
          paid_by: headers[autoMapping.paid_by] || '',
        });

        // Parse preview data for all rows (skip header)
        const previewData: ParsedTransaction[] = [];
          const dateIdx = autoMapping.date >= 0 ? autoMapping.date : 0;
          const amountIdx = autoMapping.amount >= 0 ? autoMapping.amount : 1;
          const descIdx = autoMapping.description >= 0 ? autoMapping.description : 2;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          previewData.push({
            id: `csv-${i}`,
            date: row[dateIdx] || '',
            amount: row[amountIdx] || '',
            description: row[descIdx] || '',
            category: autoMapping.category >= 0 ? (row[autoMapping.category] || '') : '',
            payment_method: paymentMethodOverride || (autoMapping.payment_method >= 0 ? (row[autoMapping.payment_method] || '') : '') || 'Other',
            paid_by: autoMapping.paid_by >= 0 ? (row[autoMapping.paid_by] || null) : null,
              year: selectedYear,
              month: periodType === 'month' ? periodValue : undefined,
              quarter: periodType === 'quarter' ? periodValue : undefined,
            });
        }
        
        setPreview(previewData);
      } catch (err: any) {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare transactions for import from the current preview state
      const transactions = preview.map((t) => ({
        date: t.date || null,
        amount: t.amount,
        description: t.description,
        category: t.category || null, // Allow null/empty for uncategorized
        payment_method: t.payment_method || 'Other',
        paid_by: t.paid_by || null,
        year: t.year ?? selectedYear,
        month: t.month ?? (periodType === 'month' ? periodValue : undefined),
        quarter: t.quarter ?? (periodType === 'quarter' ? periodValue : undefined),
      }));

          const response = await fetch('/api/transactions/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({ transactions }),
          });

          if (!response.ok) {
            const data = await response.json();
            const errorMessage = data.error || `Failed to import transactions (${response.status})`;
            throw new Error(errorMessage);
          }

          const data = await response.json();
          alert(`Successfully imported ${data.count} transactions!`);
          setFile(null);
          setPreview([]);
          onSuccess();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

  const handlePreviewEdit = (id: string, field: keyof ParsedTransaction, value: any) => {
    setPreview((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      )
    );
  };

  const handleDeletePreview = (id: string) => {
    setPreview((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="csv-file" className="block text-sm font-medium mb-1">
          Upload CSV File
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-500 mt-1">
          CSV should have columns: Date, Amount, Description, Category, Payment Method, Paid By (optional)
        </p>
      </div>

      {file && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="import-year" className="block text-sm font-medium mb-1">
                Year *
              </label>
              <input
                id="import-year"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                min="2000"
                max="2100"
                required
                className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="import-period-type" className="block text-sm font-medium mb-1">
                Period Type *
              </label>
              <select
                id="import-period-type"
                value={periodType}
                onChange={(e) => {
                  setPeriodType(e.target.value as 'month' | 'quarter' | 'year');
                  if (e.target.value === 'year') {
                    setPeriodValue(0);
                  } else if (e.target.value === 'month' && periodValue === 0) {
                    setPeriodValue(new Date().getMonth() + 1);
                  } else if (e.target.value === 'quarter' && periodValue === 0) {
                    setPeriodValue(Math.ceil((new Date().getMonth() + 1) / 3));
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
              <label htmlFor="import-period-value" className="block text-sm font-medium mb-1">
                {periodType === 'month' ? 'Month *' : periodType === 'quarter' ? 'Quarter *' : 'Year'}
              </label>
              {periodType === 'month' ? (
                <select
                  id="import-period-value"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              ) : periodType === 'quarter' ? (
                <select
                  id="import-period-value"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(parseInt(e.target.value))}
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
                  id="import-period-value"
                  type="text"
                  value="Full Year"
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label htmlFor="payment-method-override" className="block text-sm font-medium mb-1">
                Payment Method Override (Optional)
              </label>
              <select
                id="payment-method-override"
                value={paymentMethodOverride}
                onChange={(e) => setPaymentMethodOverride(e.target.value as PaymentMethod | '')}
                className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Use CSV column (no override)</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.name}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            All imported transactions will be assigned to the selected year and period. Payment method override is optional.
          </p>

          <button
            onClick={handlePreview}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Preview CSV
          </button>

          {preview.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium">
                Preview ({preview.length} transaction{preview.length !== 1 ? 's' : ''}):
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-[800px] md:min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28 md:w-32">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 min-w-[200px] md:min-w-[300px]">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-32 md:w-40">Category</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20 md:w-24">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-32 md:w-40">Payment Method</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-sm w-28 md:w-32">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handlePreviewEdit(row.id, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm min-w-[200px] md:min-w-[300px]">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handlePreviewEdit(row.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm w-32 md:w-40">
                          <select
                            value={row.category}
                            onChange={(e) => handlePreviewEdit(row.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name} ({cat.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-sm text-right w-20 md:w-24">
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => handlePreviewEdit(row.id, 'amount', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm w-32 md:w-40">
                          <input
                            type="text"
                            value={row.payment_method}
                            onChange={(e) => handlePreviewEdit(row.id, 'payment_method', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => handleDeletePreview(row.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${preview.length} Transactions`}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

