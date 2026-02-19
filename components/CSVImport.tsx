'use client';

import { useEffect, useMemo, useState } from 'react';
import { Category, CategoryRule, CategoryRuleBlocklist, PaymentMethod } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { suggestCategoryIdForDescription } from '@/lib/rules/categoryRules';

interface CSVImportProps {
  categories: Category[];
  onSuccess: () => void;
  isShared?: boolean;
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

type ColumnMapping = {
  date: string;
  amount: string;
  description: string;
  category: string;
  payment_method: string;
  paid_by: string;
};

const EMPTY_MAPPING: ColumnMapping = {
  date: '',
  amount: '',
  description: '',
  category: '',
  payment_method: '',
  paid_by: '',
};

const REQUIRED_MAPPING_FIELDS: Array<keyof ColumnMapping> = ['date', 'amount', 'description'];

const CSV_TEMPLATE = `Date,Amount,Description,Category,Payment Method,Paid By
2025-01-15,45.99,Grocery Store,Grocery,Chase Sapphire,joint
2025-01-16,12.50,Coffee Shop,Food - Cafe,BOA Travel,mano
2025-01-17,89.00,Gas Station,Car - Gas,Chase Freedom,sobi
`;

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .trim()
    .replace(/^\ufeff/, '')
    .replace(/[\s_-]+/g, ' ');

const findHeaderIndex = (normalizedHeaders: string[], candidates: string[]) => {
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex(
      (header) => header === candidate || header.includes(candidate)
    );
    if (index !== -1) return index;
  }
  return -1;
};

const detectMapping = (headers: string[]): ColumnMapping => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const pickHeader = (candidates: string[]) => {
    const index = findHeaderIndex(normalizedHeaders, candidates);
    return index >= 0 ? headers[index] : '';
  };

  return {
    date: pickHeader(['transaction date', 'post date', 'date']),
    amount: pickHeader(['amount', 'amt', 'value', 'total', 'debit', 'credit']),
    description: pickHeader(['description', 'details', 'merchant', 'payee', 'memo', 'note']),
    category: pickHeader(['category']),
    payment_method: pickHeader(['payment method', 'card', 'account']),
    paid_by: pickHeader(['paid by', 'owner', 'who']),
  };
};

export default function CSVImport({ categories, onSuccess, isShared }: CSVImportProps) {
  const { paymentMethods } = usePaymentMethods();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCategorizeEnabled, setAutoCategorizeEnabled] = useState(true);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [blocklist, setBlocklist] = useState<CategoryRuleBlocklist[]>([]);
  const [paymentMethodOverride, setPaymentMethodOverride] = useState<PaymentMethod | ''>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [periodValue, setPeriodValue] = useState<number>(new Date().getMonth() + 1);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);

  useEffect(() => {
    // Load rules once; if migration isn't applied yet, this will just no-op with an error shown in console.
    const loadRules = async () => {
      try {
        const res = await fetch('/api/category-rules', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setRules(data.rules || []);
        setBlocklist(data.blocklist || []);
      } catch {
        // ignore
      }
    };
    loadRules();
  }, []);

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const applyRulesToPreview = (rows: ParsedTransaction[]) => {
    if (!autoCategorizeEnabled) return rows;
    if (rules.length === 0) return rows;

    return rows.map(row => {
      // Respect explicit category in CSV if provided
      if (row.category && row.category.trim()) return row;

      const suggestion = suggestCategoryIdForDescription({
        description: row.description,
        rules,
        blocklist,
        categories,
      });
      if (!suggestion) return row;

      const cat = categoriesById.get(suggestion.category_id);
      if (!cat) return row;

      return { ...row, category: cat.name };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setHeaders([]);
      setRawRows([]);
      setMapping(EMPTY_MAPPING);
      setError(null);
    }
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(current.trim());
        if (row.some(value => value !== '')) {
          rows.push(row);
        }
        row = [];
        current = '';
        continue;
      }

      current += char;
    }

    row.push(current.trim());
    if (row.some(value => value !== '')) {
      rows.push(row);
    }

    return rows;
  };

  const rebuildPreview = (rows: string[][], currentMapping: ColumnMapping) => {
    const missingRequired = REQUIRED_MAPPING_FIELDS.filter((field) => !currentMapping[field]);
    if (missingRequired.length > 0) {
      setPreview([]);
      setError(`Select CSV columns for: ${missingRequired.join(', ')}`);
      return;
    }

    const headerRow = rows[0] || [];
    const headerIndex = new Map(headerRow.map((header, index) => [header, index]));
    const getValue = (row: string[], columnName: string) => {
      if (!columnName) return '';
      const index = headerIndex.get(columnName);
      return index === undefined ? '' : row[index] ?? '';
    };

    const previewData: ParsedTransaction[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const date = getValue(row, currentMapping.date);
      const amount = getValue(row, currentMapping.amount);
      const description = getValue(row, currentMapping.description);
      const category = currentMapping.category ? getValue(row, currentMapping.category) : '';
      const paidByValue = currentMapping.paid_by ? getValue(row, currentMapping.paid_by) : '';
      const paymentMethod =
        paymentMethodOverride ||
        (currentMapping.payment_method ? getValue(row, currentMapping.payment_method) : '') ||
        'Other';

      if (!date && !amount && !description && !category && !paidByValue) continue;

      previewData.push({
        id: `csv-${i}`,
        date,
        amount,
        description,
        category,
        payment_method: paymentMethod,
        paid_by: paidByValue ? paidByValue : null,
        year: selectedYear,
        month: periodType === 'month' ? periodValue : undefined,
        quarter: periodType === 'quarter' ? periodValue : undefined,
      });
    }

    setError(null);
    setPreview(applyRulesToPreview(previewData));
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => {
      const next = { ...prev, [field]: value };
      if (rawRows.length > 0) {
        rebuildPreview(rawRows, next);
      }
      return next;
    });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transactions-import-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          setPreview([]);
          setHeaders([]);
          setRawRows([]);
          return;
        }

        const rawHeaders = rows[0].map((header) => header.replace(/^\ufeff/, '').trim());
        rows[0] = rawHeaders;
        const autoMapping = detectMapping(rawHeaders);

        setHeaders(rawHeaders);
        setRawRows(rows);
        setMapping(autoMapping);
        rebuildPreview(rows, autoMapping);
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
            credentials: 'include',
            body: JSON.stringify({ transactions, is_shared: isShared !== undefined ? isShared : true }),
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
        <div className="text-sm text-gray-500 mt-1 space-y-1">
          <p>
            Required columns: Date, Amount, Description. Optional: Category, Payment Method, Paid By.
          </p>
          <p>
            We auto-detect common headers like Transaction Date, Post Date, Details, Memo, or
            Merchant. Extra columns are ignored.
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Download CSV template
          </button>
        </div>
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
          <div className="flex items-center gap-2">
            <input
              id="auto-categorize"
              type="checkbox"
              checked={autoCategorizeEnabled}
              onChange={(e) => setAutoCategorizeEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="auto-categorize" className="text-sm text-gray-700">
              Auto-select categories using rules (recommended)
            </label>
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

          {headers.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Column Mapping</div>
              <p className="text-sm text-gray-500">
                Match your CSV columns to fields. Required: Date, Amount, Description. Optional
                fields can be left blank.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date Column *</label>
                  <select
                    value={mapping.date}
                    onChange={(e) => handleMappingChange('date', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {headers.map((header) => (
                      <option key={`date-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Column *</label>
                  <select
                    value={mapping.amount}
                    onChange={(e) => handleMappingChange('amount', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {headers.map((header) => (
                      <option key={`amount-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description Column *</label>
                  <select
                    value={mapping.description}
                    onChange={(e) => handleMappingChange('description', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {headers.map((header) => (
                      <option key={`description-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category Column</label>
                  <select
                    value={mapping.category}
                    onChange={(e) => handleMappingChange('category', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(Not in file)</option>
                    {headers.map((header) => (
                      <option key={`category-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method Column</label>
                  <select
                    value={mapping.payment_method}
                    onChange={(e) => handleMappingChange('payment_method', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(Not in file)</option>
                    {headers.map((header) => (
                      <option key={`payment-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Paid By Column</label>
                  <select
                    value={mapping.paid_by}
                    onChange={(e) => handleMappingChange('paid_by', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(Not in file)</option>
                    {headers.map((header) => (
                      <option key={`paidby-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

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

