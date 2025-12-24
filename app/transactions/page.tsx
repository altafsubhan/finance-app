'use client';

import { useState, useEffect } from 'react';
import { Transaction, Category } from '@/types/database';
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import CSVImport from '@/components/CSVImport';
import ScreenshotImport from '@/components/ScreenshotImport';
import BulkEditBar from '@/components/BulkEditBar';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { format, startOfYear, endOfYear } from 'date-fns';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showScreenshotImport, setShowScreenshotImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<'monthly' | 'quarterly' | 'yearly' | ''>('');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedCategory, selectedPaymentMethod, selectedCategoryType, selectedPaidBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load categories
      const categoriesRes = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      // Load transactions
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedPaymentMethod) params.append('payment_method', selectedPaymentMethod);
      if (selectedPaidBy) params.append('paid_by', selectedPaidBy);

      const transactionsRes = await fetch(`/api/transactions?${params.toString()}`, {
        credentials: 'include',
      });
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingTransaction(null);
    loadData();
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = () => {
    loadData();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen p-8 bg-gray-50 ${selectedTransactionIds.size > 0 ? 'pb-32' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Transactions</h1>
          {!showForm && !showCSVImport && !showScreenshotImport && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowScreenshotImport(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Import Screenshot
              </button>
              <button
                onClick={() => setShowCSVImport(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Import CSV
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add Transaction
              </button>
            </div>
          )}
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

        <div className="mb-6 flex flex-wrap gap-4">
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

          <div>
            <label htmlFor="category_type" className="block text-sm font-medium mb-1">
              Category Type
            </label>
            <select
              id="category_type"
              value={selectedCategoryType}
              onChange={(e) => setSelectedCategoryType(e.target.value as 'monthly' | 'quarterly' | 'yearly' | '')}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

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
              <option value="BOA Travel">BOA Travel</option>
              <option value="BOA CB">BOA CB</option>
              <option value="Chase Sapphire">Chase Sapphire</option>
              <option value="Chase Amazon">Chase Amazon</option>
              <option value="Chase Freedom">Chase Freedom</option>
              <option value="Mano Chase Freedom">Mano Chase Freedom</option>
              <option value="Sobi Chase Freedom">Sobi Chase Freedom</option>
              <option value="Mano Discover">Mano Discover</option>
              <option value="Sobi Discover">Sobi Discover</option>
              <option value="Mano Amex">Mano Amex</option>
              <option value="Subi Chase Debit">Subi Chase Debit</option>
              <option value="BILT">BILT</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
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
                <option key={option.value || 'null'} value={option.value || ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          </div>

        <TransactionList
          transactions={transactions}
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          categoryTypeFilter={selectedCategoryType}
          onUpdate={loadData}
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

        {selectedTransactionIds.size > 0 && (
          <BulkEditBar
            selectedCount={selectedTransactionIds.size}
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
            onCancel={() => setSelectedTransactionIds(new Set())}
          />
        )}
      </div>
    </main>
  );
}

