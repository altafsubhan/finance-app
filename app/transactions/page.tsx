'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction, Category } from '@/types/database';
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import CSVImport from '@/components/CSVImport';
import ScreenshotImport from '@/components/ScreenshotImport';
import BulkEditBar from '@/components/BulkEditBar';
import OutstandingSummary from '@/components/OutstandingSummary';
import SplitTransactionModal, { Split } from '@/components/SplitTransactionModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { format, startOfYear, endOfYear } from 'date-fns';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showScreenshotImport, setShowScreenshotImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<'monthly' | 'quarterly' | 'yearly' | ''>('');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [summariesExpanded, setSummariesExpanded] = useState(true);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      
      // Load transactions
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      if (selectedMonth && selectedCategoryType === 'monthly') {
        params.append('month', selectedMonth);
      }
      if (selectedQuarter && selectedCategoryType === 'quarterly') {
        params.append('quarter', selectedQuarter);
      }
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedPaymentMethod) params.append('payment_method', selectedPaymentMethod);
      if (selectedPaidBy) {
        // Convert empty string (which represents null/Not Paid) to the string 'null'
        // Empty string means "All", so only append if it's not empty
        params.append('paid_by', selectedPaidBy);
      }

      const transactionsRes = await fetch(`/api/transactions?${params.toString()}`, {
        credentials: 'include',
      });
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [selectedYear, selectedMonth, selectedQuarter, selectedCategory, selectedPaymentMethod, selectedCategoryType, selectedPaidBy]);

  // Load categories and transactions on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesRes = await fetch('/api/categories', {
          credentials: 'include',
        });
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    
    const initialLoad = async () => {
      setInitialLoading(true);
      await loadCategories();
      await loadTransactions();
      setInitialLoading(false);
    };
    
    initialLoad();
  }, []);

  // Reload transactions when filters change (but not on initial mount)
  useEffect(() => {
    if (!initialLoading) {
      loadTransactions();
    }
  }, [loadTransactions, initialLoading]);

  const loadData = async () => {
    await loadTransactions();
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingTransaction(null);
    loadData();
  };

  const handleEdit = (transaction: Transaction) => {
    // Open modal instead of scrolling to top
    setEditingTransactionModal(transaction);
  };

  const handleDelete = () => {
    loadData();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (initialLoading) {
    return (
      <main className="min-h-screen p-1 sm:p-4 lg:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen p-1 sm:p-4 lg:p-8 bg-gray-50 ${selectedTransactionIds.size > 0 ? 'pb-32' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col mb-4 sm:mb-8 gap-2 sm:gap-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h1 className="text-2xl sm:text-4xl font-bold">Transactions</h1>
            {!showForm && !showCSVImport && !showScreenshotImport && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScreenshotImport(true)}
                  className="bg-purple-600 text-white px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-lg hover:bg-purple-700 whitespace-nowrap flex-1 sm:flex-none"
                >
                  Import Screenshot
                </button>
                <button
                  onClick={() => setShowCSVImport(true)}
                  className="bg-green-600 text-white px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-lg hover:bg-green-700 whitespace-nowrap flex-1 sm:flex-none"
                >
                  Import CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="mb-8 p-6 bg-white border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">
                {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            <TransactionForm
              categories={categories}
              onSuccess={handleSuccess}
              initialData={editingTransaction || null}
            />
          </div>
        )}

        {showCSVImport && (
          <div className="mb-8 p-6 bg-white border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Import Transactions from CSV</h2>
              <button
                onClick={() => {
                  setShowCSVImport(false);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            <CSVImport
              categories={categories}
              onSuccess={() => {
                setShowCSVImport(false);
                loadData();
              }}
            />
          </div>
        )}

        {showScreenshotImport && (
          <div className="mb-8 p-6 bg-white border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Import Transactions from Screenshot</h2>
              <button
                onClick={() => {
                  setShowScreenshotImport(false);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            <ScreenshotImport
              categories={categories}
              onSuccess={() => {
                setShowScreenshotImport(false);
                loadData();
              }}
            />
          </div>
        )}

        {/* Filters Section - Collapsible */}
        <div className="mb-6 bg-white border rounded-lg">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
          >
            <span className="font-medium text-gray-900">Filters</span>
            <span className="text-gray-500">{filtersExpanded ? '−' : '+'}</span>
          </button>
          {filtersExpanded && (
            <div className="px-4 pb-4 pt-2">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label htmlFor="year" className="block text-sm font-medium mb-1">
                    Year
                  </label>
                  <select
                    id="year"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

          <div>
            <label htmlFor="category_type" className="block text-sm font-medium mb-1">
              Category Type
            </label>
            <select
              id="category_type"
              value={selectedCategoryType}
              onChange={(e) => {
                const newType = e.target.value as 'monthly' | 'quarterly' | 'yearly' | '';
                setSelectedCategoryType(newType);
                // Clear period-specific filters when changing category type
                setSelectedMonth('');
                setSelectedQuarter('');
              }}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {selectedCategoryType === 'monthly' && (
            <div>
              <label htmlFor="month" className="block text-sm font-medium mb-1">
                Month
              </label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {selectedCategoryType === 'quarterly' && (
            <div>
              <label htmlFor="quarter" className="block text-sm font-medium mb-1">
                Quarter
              </label>
              <select
                id="quarter"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Quarters</option>
                <option value="1">Q1 (Jan-Mar)</option>
                <option value="2">Q2 (Apr-Jun)</option>
                <option value="3">Q3 (Jul-Sep)</option>
                <option value="4">Q4 (Oct-Dec)</option>
              </select>
            </div>
          )}

          {selectedCategoryType === 'yearly' && (
            <div>
              <label htmlFor="year_only" className="block text-sm font-medium mb-1">
                Year
              </label>
              <div className="px-4 py-2 border rounded-lg bg-gray-100 text-gray-500">
                {selectedYear} (All transactions for this year)
              </div>
            </div>
          )}

          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-1">
              Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories
                .filter(cat => !selectedCategoryType || cat.type === selectedCategoryType)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment_method" className="block text-sm font-medium mb-1">
              Payment Method
            </label>
            <select
              id="payment_method"
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Methods</option>
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
              value={selectedPaidBy}
              onChange={(e) => setSelectedPaidBy(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {PAID_BY_OPTIONS.map((option) => (
                <option key={option.value || 'null'} value={option.value === null ? 'null' : option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
              </div>
            </div>
          )}
        </div>

        {/* Summaries Section - Collapsible */}
        <div className="mb-6 bg-white border rounded-lg">
          <button
            onClick={() => setSummariesExpanded(!summariesExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
          >
            <span className="font-medium text-gray-900">Summaries & Visualizations</span>
            <span className="text-gray-500">{summariesExpanded ? '−' : '+'}</span>
          </button>
          {summariesExpanded && (
            <div className="px-4 pb-4 pt-2 space-y-4">
              {/* Outstanding Amount Summary */}
              <OutstandingSummary
                transactions={transactions}
                categories={categories}
                onMarkPaid={loadTransactions}
              />
            </div>
          )}
        </div>

        {/* Transactions List - Collapsible */}
        <div className="mb-6 bg-white border rounded-lg">
          <button
            onClick={() => setTransactionsExpanded(!transactionsExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
          >
            <h2 className="text-lg font-semibold">Transactions</h2>
            <span className="text-gray-500">{transactionsExpanded ? '−' : '+'}</span>
          </button>
          {transactionsExpanded && (
            <div className="p-4 border-t border-gray-200">
              {loadingTransactions ? (
                <div className="p-8 text-center">
                  <div className="text-gray-500">Loading transactions...</div>
                </div>
              ) : (
                <TransactionList
                  transactions={transactions}
                  categories={categories}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  categoryTypeFilter={selectedCategoryType}
                  selectedIds={selectedTransactionIds}
                  onSelectionChange={setSelectedTransactionIds}
                  onAddTransaction={async (data) => {
                    const response = await fetch('/api/transactions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(data),
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to add transaction');
                    }
                  }}
                />
              )}
            </div>
          )}
        </div>

        {selectedTransactionIds.size > 0 && (
          <BulkEditBar
            selectedCount={selectedTransactionIds.size}
            selectedIds={Array.from(selectedTransactionIds)}
            selectedTransactions={transactions.filter(t => selectedTransactionIds.has(t.id)).map(t => ({ id: t.id, amount: t.amount }))}
            categories={categories}
            onBulkUpdate={async (updates) => {
              const response = await fetch('/api/transactions/bulk-update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  transaction_ids: Array.from(selectedTransactionIds),
                  updates,
                }),
              });

              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update transactions');
              }

              setSelectedTransactionIds(new Set());
              loadData();
            }}
            onBulkDelete={async (ids: string[]) => {
              // Delete all selected transactions in parallel
              const deletePromises = ids.map(id =>
                fetch(`/api/transactions/${id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                })
              );

              const results = await Promise.all(deletePromises);
              const failed = results.filter(r => !r.ok);

              if (failed.length > 0) {
                throw new Error(`Failed to delete ${failed.length} transaction${failed.length > 1 ? 's' : ''}`);
              }

              setSelectedTransactionIds(new Set());
              loadData();
            }}
            onBulkEdit={(transactionId: string) => {
              const transaction = transactions.find(t => t.id === transactionId);
              if (transaction) {
                handleEdit(transaction);
                setSelectedTransactionIds(new Set());
              }
            }}
            onBulkSplit={(transactionId: string) => {
              const transaction = transactions.find(t => t.id === transactionId);
              if (transaction) {
                setSplittingTransaction(transaction);
                setSelectedTransactionIds(new Set());
              }
            }}
            onCancel={() => setSelectedTransactionIds(new Set())}
          />
        )}

        {splittingTransaction && (
          <SplitTransactionModal
            transaction={splittingTransaction}
            categories={categories}
            onClose={() => setSplittingTransaction(null)}
            onSave={async (splits: Split[]) => {
              const response = await fetch(`/api/transactions/${splittingTransaction.id}/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ splits }),
              });

              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to split transaction');
              }

              setSplittingTransaction(null);
              loadData();
            }}
          />
        )}

        {editingTransactionModal && (
          <EditTransactionModal
            transaction={editingTransactionModal}
            categories={categories}
            onClose={() => setEditingTransactionModal(null)}
            onSuccess={() => {
              setEditingTransactionModal(null);
              loadData();
            }}
          />
        )}
      </div>
    </main>
  );
}

