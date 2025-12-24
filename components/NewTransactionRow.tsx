'use client';

import { Category, PaymentMethod, PaidBy } from '@/types/database';
import { PAYMENT_METHODS, PAID_BY_OPTIONS } from '@/lib/constants';
import { NewTransactionRowState } from './TransactionList';

interface NewTransactionRowProps {
  row: NewTransactionRowState;
  categories: Category[];
  onChange: (updatedRow: NewTransactionRowState) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
  loading?: boolean;
}

export default function NewTransactionRow({ row, categories, onChange, onCancel, onSave, loading = false }: NewTransactionRowProps) {
  const currentDate = new Date();

  // Handle field changes
  const handleDateChange = (date: string) => {
    let updatedRow = { ...row, date, error: undefined };
    
    // Auto-populate period fields from date
    if (date) {
      try {
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          const dateMonth = dateObj.getMonth() + 1;
          const category = categories.find(c => c.id === row.category_id);
          
          if (category) {
            if (category.type === 'monthly') {
              updatedRow.periodType = 'month';
              updatedRow.periodValue = dateMonth;
            } else if (category.type === 'quarterly') {
              updatedRow.periodType = 'quarter';
              updatedRow.periodValue = Math.ceil(dateMonth / 3);
            } else if (category.type === 'yearly') {
              updatedRow.periodType = 'year';
              updatedRow.periodValue = '';
            }
          } else {
            updatedRow.periodType = 'month';
            updatedRow.periodValue = dateMonth;
          }
        }
      } catch {
        // Invalid date, ignore
      }
    }
    
    onChange(updatedRow);
  };

  const handleCategoryChange = (categoryId: string) => {
    let updatedRow = { ...row, category_id: categoryId, error: undefined };
    
    // Auto-set period type when category changes
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      if (category.type === 'monthly') {
        updatedRow.periodType = 'month';
        if (!updatedRow.periodValue || updatedRow.periodValue < 1 || updatedRow.periodValue > 12) {
          if (row.date) {
            const dateObj = new Date(row.date);
            if (!isNaN(dateObj.getTime())) {
              updatedRow.periodValue = dateObj.getMonth() + 1;
            } else {
              updatedRow.periodValue = currentDate.getMonth() + 1;
            }
          } else {
            updatedRow.periodValue = currentDate.getMonth() + 1;
          }
        }
      } else if (category.type === 'quarterly') {
        updatedRow.periodType = 'quarter';
        if (!updatedRow.periodValue || updatedRow.periodValue < 1 || updatedRow.periodValue > 4) {
          if (row.date) {
            const dateObj = new Date(row.date);
            if (!isNaN(dateObj.getTime())) {
              updatedRow.periodValue = Math.ceil((dateObj.getMonth() + 1) / 3);
            } else {
              updatedRow.periodValue = Math.ceil((currentDate.getMonth() + 1) / 3);
            }
          } else {
            updatedRow.periodValue = Math.ceil((currentDate.getMonth() + 1) / 3);
          }
        }
      } else if (category.type === 'yearly') {
        updatedRow.periodType = 'year';
        updatedRow.periodValue = '';
      }
    }
    
    onChange(updatedRow);
  };

  const handleFieldChange = (field: keyof NewTransactionRowState, value: any) => {
    onChange({ ...row, [field]: value, error: undefined });
  };

  return (
    <tr className="bg-green-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={row.payment_method}
          onChange={(e) => handleFieldChange('payment_method', e.target.value)}
          className="w-40 px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Payment method</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <input
          type="number"
          step="0.01"
          value={row.amount}
          onChange={(e) => handleFieldChange('amount', e.target.value)}
          className="w-32 px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          placeholder="Amount"
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="text"
          value={row.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Description"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={row.category_id}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="w-48 px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="date"
          value={row.date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-32 px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Date"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={row.paid_by || ''}
          onChange={(e) => handleFieldChange('paid_by', e.target.value as PaidBy || null)}
          className="w-32 px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Not paid</option>
          {PAID_BY_OPTIONS.filter(opt => opt.value !== null).map((option) => (
            <option key={option.value || 'null'} value={option.value || ''}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end gap-2">
          {row.error && <span className="text-xs text-red-600 mr-2">{row.error}</span>}
          <button
            onClick={onSave}
            disabled={loading}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
