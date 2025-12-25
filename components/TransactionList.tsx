'use client';

import { useState, useRef, useEffect } from 'react';
import { Transaction, Category, PaidBy } from '@/types/database';
import { format } from 'date-fns';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import EditableCategoryCell from './EditableCategoryCell';
import EditablePaidByCell from './EditablePaidByCell';
import NewTransactionRow from './NewTransactionRow';
import { PaymentMethod } from '@/types/database';

type SortField = 'date' | 'description' | 'category' | 'payment_method' | 'amount' | 'paid_by';
type SortDirection = 'asc' | 'desc';

export interface NewTransactionRowState {
  id: string; // temporary ID
  date: string;
  description: string;
  amount: string;
  category_id: string;
  payment_method: PaymentMethod | '';
  paid_by: PaidBy;
  periodType: 'month' | 'quarter' | 'year';
  periodValue: number | '';
  error?: string; // Field-level error message
}

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  categoryTypeFilter?: 'monthly' | 'quarterly' | 'yearly' | '';
  onUpdate?: (transactionId: string, updates: { category_id?: string; paid_by?: any }) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onAddTransaction?: (data: any) => Promise<void>;
}

const noOpSelectionChange = (ids: Set<string>) => {};

export default function TransactionList({ transactions, categories, onEdit, onDelete, categoryTypeFilter, onUpdate, selectedIds = new Set(), onSelectionChange = noOpSelectionChange, onAddTransaction }: TransactionListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [newTransactionRows, setNewTransactionRows] = useState<NewTransactionRowState[]>([]);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Exit selection mode when no items are selected
  useEffect(() => {
    if (selectedIds.size === 0) {
      setIsSelectionMode(false);
    }
  }, [selectedIds]);

  // Validate a single row
  const validateRow = (row: NewTransactionRowState): string | null => {
    if (!row.description.trim()) {
      return 'Description is required';
    }
    if (!row.amount || parseFloat(row.amount) === 0) {
      return 'Amount is required';
    }
    // Category is now optional - no validation needed
    if (!row.payment_method) {
      return 'Payment method is required';
    }
    if (row.periodType !== 'year' && !row.periodValue) {
      return `${row.periodType === 'month' ? 'Month' : 'Quarter'} is required`;
    }
    return null;
  };

  // Convert row state to API payload
  const rowToPayload = (row: NewTransactionRowState) => {
    const currentDate = new Date();
    let transactionYear = currentDate.getFullYear();
    
    if (row.date) {
      try {
        const dateObj = new Date(row.date);
        if (!isNaN(dateObj.getTime())) {
          transactionYear = dateObj.getFullYear();
        }
      } catch {
        // Invalid date, use current year
      }
    }

    return {
      date: row.date || null,
      description: row.description.trim(),
      amount: parseFloat(row.amount),
      category_id: row.category_id || null, // Allow null/empty category_id
      payment_method: row.payment_method as PaymentMethod,
      paid_by: row.paid_by,
      year: transactionYear,
      month: row.periodType === 'month' ? (row.periodValue ? parseInt(row.periodValue.toString()) : null) : null,
      quarter: row.periodType === 'quarter' ? (row.periodValue ? parseInt(row.periodValue.toString()) : null) : null,
    };
  };

  // Save a single row
  const handleSaveRow = async (rowId: string) => {
    const row = newTransactionRows.find(r => r.id === rowId);
    if (!row || !onAddTransaction) return;

    const error = validateRow(row);
    if (error) {
      setNewTransactionRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, error } : r
      ));
      return;
    }

    setSavingRows(prev => new Set(prev).add(rowId));
    try {
      const payload = rowToPayload(row);
      await onAddTransaction(payload);
      setNewTransactionRows(prev => prev.filter(r => r.id !== rowId));
    } catch (err: any) {
      setNewTransactionRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, error: err.message || 'Failed to save transaction' } : r
      ));
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  // Save all rows
  const handleSaveAll = async () => {
    if (!onAddTransaction || newTransactionRows.length === 0) return;

    // Validate all rows first
    const rowsWithErrors = newTransactionRows.map(row => {
      const error = validateRow(row);
      return { row, error };
    });

    // Update rows with validation errors
    setNewTransactionRows(prev => prev.map(r => {
      const errorRow = rowsWithErrors.find(e => e.row.id === r.id);
      return { ...r, error: errorRow?.error ?? undefined };
    }));

    // Filter out rows with errors
    const validRows = rowsWithErrors.filter(r => !r.error).map(r => r.row);
    
    if (validRows.length === 0) {
      return; // No valid rows to save
    }

    // Mark all as saving
    setSavingRows(new Set(validRows.map(r => r.id)));

    try {
      // Save all valid rows in parallel
      const savePromises = validRows.map(row => {
        const payload = rowToPayload(row);
        return onAddTransaction(payload);
      });

      await Promise.all(savePromises);
      
      // Remove all saved rows
      setNewTransactionRows(prev => prev.filter(r => !validRows.find(vr => vr.id === r.id)));
      
      // Note: Parent component should handle refreshing the list when new transactions are added
    } catch (err: any) {
      // If there's an error, we can't easily tell which row failed with Promise.all
      // So we'll just show a general error
      alert('Some transactions failed to save. Please try saving individually.');
    } finally {
      setSavingRows(new Set());
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getCategoryType = (categoryId: string): 'monthly' | 'quarterly' | 'yearly' | null => {
    return categories.find(c => c.id === categoryId)?.type || null;
  };

  const getCategoryTypeBadge = (type: 'monthly' | 'quarterly' | 'yearly' | null) => {
    if (!type) return null;
    const colors = {
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-purple-100 text-purple-800',
      yearly: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${colors[type]}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Sort function
  const sortTransactions = (txns: Transaction[]) => {
    return [...txns].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.date ? new Date(a.date).getTime() : 0;
          bValue = b.date ? new Date(b.date).getTime() : 0;
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'category':
          aValue = a.category_id ? (categories.find(c => c.id === a.category_id)?.name || '') : 'Uncategorized';
          bValue = b.category_id ? (categories.find(c => c.id === b.category_id)?.name || '') : 'Uncategorized';
          break;
        case 'payment_method':
          aValue = a.payment_method;
          bValue = b.payment_method;
          break;
        case 'amount':
          aValue = parseFloat(a.amount.toString());
          bValue = parseFloat(b.amount.toString());
          break;
        case 'paid_by':
          aValue = a.paid_by || '';
          bValue = b.paid_by || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Group transactions by category type (after sorting)
  const sortedTransactions = sortTransactions(transactions);
  const groupedTransactions = {
    monthly: sortedTransactions.filter(t => getCategoryType(t.category_id) === 'monthly'),
    quarterly: sortedTransactions.filter(t => getCategoryType(t.category_id) === 'quarterly'),
    yearly: sortedTransactions.filter(t => getCategoryType(t.category_id) === 'yearly'),
    uncategorized: sortedTransactions.filter(t => !t.category_id), // Uncategorized transactions
  };

  // If filter is set, only show that type
  const displayTransactions = categoryTypeFilter 
    ? groupedTransactions[categoryTypeFilter]
    : sortedTransactions;

  const getPaidByColor = (paidBy: PaidBy) => {
    const option = PAID_BY_OPTIONS.find(opt => opt.value === paidBy);
    return option?.color || 'bg-gray-200';
  };

  const getPaidByLabel = (paidBy: PaidBy) => {
    const option = PAID_BY_OPTIONS.find(opt => opt.value === paidBy);
    return option?.label || 'Not Paid';
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      onDelete(id);
      setConfirmDelete(null);
    } catch (error) {
      alert('Failed to delete transaction');
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No transactions found. Add your first transaction above!
      </div>
    );
  }

  // Render grouped view if no filter is set
  if (!categoryTypeFilter) {
    return (
      <div className="space-y-8">
        {groupedTransactions.monthly.length > 0 && (
          <div className="bg-white border rounded-lg p-2 sm:p-4 lg:p-6">
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Monthly Expenses</h3>
              <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                {groupedTransactions.monthly.length} transactions
              </span>
            </div>
            <TransactionTable 
              transactions={groupedTransactions.monthly}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onUpdate={onUpdate}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
            />
          </div>
        )}

        {groupedTransactions.quarterly.length > 0 && (
          <div className="bg-white border rounded-lg p-2 sm:p-4 lg:p-6">
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Quarterly Expenses</h3>
              <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                {groupedTransactions.quarterly.length} transactions
              </span>
            </div>
            <TransactionTable 
              transactions={groupedTransactions.quarterly}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onUpdate={onUpdate}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
            />
          </div>
        )}

        {groupedTransactions.yearly.length > 0 && (
          <div className="bg-white border rounded-lg p-2 sm:p-4 lg:p-6">
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Yearly Expenses</h3>
              <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                {groupedTransactions.yearly.length} transactions
              </span>
            </div>
            <TransactionTable 
              transactions={groupedTransactions.yearly}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onUpdate={onUpdate}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
            />
          </div>
        )}

        {groupedTransactions.uncategorized.length > 0 && (
          <div className="bg-white border rounded-lg p-2 sm:p-4 lg:p-6">
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Uncategorized</h3>
              <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                {groupedTransactions.uncategorized.length} transactions
              </span>
            </div>
            <TransactionTable 
              transactions={groupedTransactions.uncategorized}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onUpdate={onUpdate}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
            />
          </div>
        )}

        {/* New Transaction Rows Section */}
        {newTransactionRows.length > 0 && (
          <div className="bg-white border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Transactions</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAll}
                  disabled={savingRows.size > 0 || newTransactionRows.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save All ({newTransactionRows.length})
                </button>
                <button
                  onClick={() => setNewTransactionRows([])}
                  disabled={savingRows.size > 0}
                  className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Payment Method</th>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Amount</th>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Category</th>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Date</th>
                    <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Paid By</th>
                    <th className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {newTransactionRows.map((row) => (
                    <NewTransactionRow
                      key={row.id}
                      row={row}
                      categories={categories}
                      onChange={(updatedRow) => {
                        setNewTransactionRows(prev => prev.map(r => r.id === row.id ? updatedRow : r));
                      }}
                      onSave={() => handleSaveRow(row.id)}
                      onCancel={() => {
                        setNewTransactionRows(prev => prev.filter(r => r.id !== row.id));
                      }}
                      loading={savingRows.has(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Transaction Button */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              const newId = `temp-${Date.now()}-${Math.random()}`;
              setNewTransactionRows(prev => [...prev, {
                id: newId,
                date: '',
                description: '',
                amount: '',
                category_id: '',
                payment_method: '',
                paid_by: null,
                periodType: 'month',
                periodValue: '',
              }]);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Add Transaction
          </button>
        </div>
      </div>
    );
  }

  // Render single table if filter is set
  return (
    <div>
      <div className="bg-white border rounded-lg p-2 sm:p-4 lg:p-6">
        <TransactionTable 
          transactions={displayTransactions}
          categories={categories}
          onEdit={onEdit}
          onDelete={onDelete}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onUpdate={onUpdate}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          isSelectionMode={isSelectionMode}
          setIsSelectionMode={setIsSelectionMode}
        />
      </div>

      {/* New Transaction Rows Section */}
      {newTransactionRows.length > 0 && (
        <div className="mt-6 bg-white border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">New Transactions</h3>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAll}
                disabled={savingRows.size > 0 || newTransactionRows.length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save All ({newTransactionRows.length})
              </button>
              <button
                onClick={() => setNewTransactionRows([])}
                disabled={savingRows.size > 0}
                className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid By</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {newTransactionRows.map((row) => (
                  <NewTransactionRow
                    key={row.id}
                    row={row}
                    categories={categories}
                    onChange={(updatedRow) => {
                      setNewTransactionRows(prev => prev.map(r => r.id === row.id ? updatedRow : r));
                    }}
                    onSave={() => handleSaveRow(row.id)}
                    onCancel={() => {
                      setNewTransactionRows(prev => prev.filter(r => r.id !== row.id));
                    }}
                    loading={savingRows.has(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Transaction Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => {
            const newId = `temp-${Date.now()}-${Math.random()}`;
            setNewTransactionRows(prev => [...prev, {
              id: newId,
              date: '',
              description: '',
              amount: '',
              category_id: '',
              payment_method: '',
              paid_by: null,
              periodType: 'month',
              periodValue: '',
            }]);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + Add Transaction
        </button>
      </div>
    </div>
  );
}

function TransactionTable({ 
  transactions, 
  categories, 
  onEdit, 
  onDelete, 
  confirmDelete, 
  setConfirmDelete,
  onUpdate,
  selectedIds,
  onSelectionChange,
  sortField,
  sortDirection,
  onSort,
  isSelectionMode,
  setIsSelectionMode
}: {
  transactions: Transaction[];
  categories: Category[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  confirmDelete: string | null;
  setConfirmDelete: (id: string | null) => void;
  onUpdate?: (transactionId: string, updates: { category_id?: string; paid_by?: any }) => void;
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (value: boolean) => void;
}) {
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getCategoryType = (categoryId: string): 'monthly' | 'quarterly' | 'yearly' | null => {
    return categories.find(c => c.id === categoryId)?.type || null;
  };

  const getCategoryTypeBadge = (type: 'monthly' | 'quarterly' | 'yearly' | null) => {
    if (!type) return null;
    const colors = {
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-purple-100 text-purple-800',
      yearly: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${colors[type]}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const getPaidByColor = (paidBy: PaidBy) => {
    const option = PAID_BY_OPTIONS.find(opt => opt.value === paidBy);
    return option?.color || 'bg-gray-200';
  };

  const getPaidByLabel = (paidBy: PaidBy) => {
    const option = PAID_BY_OPTIONS.find(opt => opt.value === paidBy);
    return option?.label || 'Not Paid';
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      onDelete(id);
      setConfirmDelete(null);
    } catch (error) {
      alert('Failed to delete transaction');
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No transactions in this category type.
      </div>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(transactions.map(t => t.id));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    onSelectionChange(newSelection);
    
    // Exit selection mode if no items are selected
    if (newSelection.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, transactionId: string) => {
    // Only enable touch-and-hold on mobile
    if (window.innerWidth >= 768) return;

    // Prevent text selection and context menu
    e.preventDefault();
    if (e.cancelable) {
      e.stopPropagation();
    }

    const touch = e.touches[0];
    touchStartRef.current = {
      id: transactionId,
      x: touch.clientX,
      y: touch.clientY,
    };

    // If already in selection mode, toggle immediately on touch start
    if (isSelectionMode) {
      const isSelected = selectedIds.has(transactionId);
      handleSelectOne(transactionId, !isSelected);
      return;
    }

    // Start timer for touch-and-hold
    touchHoldTimerRef.current = setTimeout(() => {
      setIsSelectionMode(true);
      // Select this row when entering selection mode
      handleSelectOne(transactionId, true);
      touchHoldTimerRef.current = null;
    }, 500); // 500ms hold time
  };

  const handleTouchEnd = (e: React.TouchEvent, transactionId: string) => {
    if (window.innerWidth >= 768) return;

    // Prevent text selection and context menu
    e.preventDefault();
    if (e.cancelable) {
      e.stopPropagation();
    }

    // Clear the timer if it hasn't fired yet
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }

    touchStartRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.innerWidth >= 768) return;

    // If user moves finger, cancel the hold timer
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  };

  const handleRowClick = (e: React.MouseEvent, transactionId: string) => {
    // On mobile, if in selection mode, treat click as toggle
    if (window.innerWidth < 768 && isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      const isSelected = selectedIds.has(transactionId);
      handleSelectOne(transactionId, !isSelected);
    }
  };

  const allSelected = transactions.length > 0 && transactions.every(t => selectedIds.has(t.id));
  const someSelected = transactions.some(t => selectedIds.has(t.id));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="hidden md:table-cell px-2 md:px-6 py-2 md:py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              <button
                onClick={() => onSort('payment_method')}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                Payment Method
                {sortField === 'payment_method' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              <button
                onClick={() => onSort('amount')}
                className="flex items-center gap-1 hover:text-gray-700 ml-auto"
              >
                Amount
                {sortField === 'amount' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <button
                onClick={() => onSort('description')}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                Description
                {sortField === 'description' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              <button
                onClick={() => onSort('category')}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                Category
                {sortField === 'category' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              <button
                onClick={() => onSort('date')}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                Date
                {sortField === 'date' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="px-1 md:px-6 py-1.5 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              <button
                onClick={() => onSort('paid_by')}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                Paid By
                {sortField === 'paid_by' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </th>
            <th className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
          {transactions.map((transaction) => {
            const categoryType = getCategoryType(transaction.category_id);
            const isSelected = selectedIds.has(transaction.id);
            return (
            <tr 
              key={transaction.id} 
              className={`${isSelected ? 'bg-blue-50' : !transaction.category_id ? 'bg-red-50' : 'hover:bg-gray-50'} ${isSelectionMode ? 'cursor-pointer' : ''}`}
              style={{
                  WebkitUserSelect: 'none', 
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  touchAction: 'manipulation'
                }}
                onTouchStart={(e) => handleTouchStart(e, transaction.id)}
                onTouchEnd={(e) => handleTouchEnd(e, transaction.id)}
                onTouchMove={handleTouchMove}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => handleRowClick(e, transaction.id)}
              >
                <td className="hidden md:table-cell px-2 md:px-6 py-3 md:py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSelectOne(transaction.id, e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-1 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm text-gray-500 w-28">
                  {transaction.payment_method}
                </td>
                <td className={`px-1 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900 w-24 ${getPaidByColor(transaction.paid_by)}`}>
                  ${parseFloat(transaction.amount.toString()).toFixed(2)}
                </td>
                <td className="px-1 md:px-6 py-2 md:py-4 text-sm text-gray-900 break-words">
                  {transaction.description}
                </td>
                <td className="px-1 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm text-gray-500 w-28">
                  <div className="flex items-center">
                    <EditableCategoryCell
                      transactionId={transaction.id}
                      currentCategoryId={transaction.category_id}
                      categories={categories}
                      onUpdate={onUpdate ? (categoryId: string | null) => onUpdate(transaction.id, { category_id: categoryId || undefined }) : () => {}}
                    />
                  </div>
                </td>
                <td className="px-1 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm text-gray-900 w-32">
                  {transaction.date ? format(new Date(transaction.date), 'MMM dd, yyyy') : '—'}
                </td>
                <td className="px-1 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm text-gray-500 w-28">
                    <EditablePaidByCell
                      transactionId={transaction.id}
                      currentPaidBy={transaction.paid_by}
                      onUpdate={onUpdate ? (paidBy: any) => onUpdate(transaction.id, { paid_by: paidBy }) : () => {}}
                    />
                </td>
                <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-right text-sm font-medium w-24">
                  {confirmDelete === transaction.id ? (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end space-x-4">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(transaction.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

