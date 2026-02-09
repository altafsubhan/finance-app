'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, Category, Budget, CategoryRule, CategoryRuleBlocklist } from '@/types/database';
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import CSVImport from '@/components/CSVImport';
import ScreenshotImport from '@/components/ScreenshotImport';
import BulkEditBar from '@/components/BulkEditBar';
import OutstandingSummary from '@/components/OutstandingSummary';
import PaymentsMadeSummary from '@/components/PaymentsMadeSummary';
import BudgetVsSpendingPanel from '@/components/BudgetVsSpendingPanel';
import SplitTransactionModal, { Split } from '@/components/SplitTransactionModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import UncategorizedAutoAssignModal from '@/components/UncategorizedAutoAssignModal';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { format, startOfYear, endOfYear } from 'date-fns';

export default function TransactionsPage() {
  const { paymentMethods } = usePaymentMethods();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [blocklist, setBlocklist] = useState<CategoryRuleBlocklist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showScreenshotImport, setShowScreenshotImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<'monthly' | 'quarterly' | 'yearly' | ''>('');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [summariesExpanded, setSummariesExpanded] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(false);
  const [uncategorizedModalOpen, setUncategorizedModalOpen] = useState(false);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [editingTransactionModal, setEditingTransactionModal] = useState<Transaction | null>(null);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const categoryFilterRef = useRef<HTMLDivElement>(null);

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export');
      return;
    }

    // Filter transactions to match current filters (same logic as loadTransactions)
    let filteredTransactions = transactions.filter(transaction => {
      // Filter by year
      if (transaction.year !== selectedYear) return false;
      
      // Filter by month if category type is monthly and month is selected
      if (selectedMonth && selectedCategoryType === 'monthly') {
        if (transaction.month !== parseInt(selectedMonth)) return false;
      }
      
      // Filter by quarter if category type is quarterly and quarter is selected
      if (selectedQuarter && selectedCategoryType === 'quarterly') {
        if (transaction.quarter !== parseInt(selectedQuarter)) return false;
      }
      
      // Filter by category type (if selected)
      if (selectedCategoryType) {
        const category = categories.find(c => c.id === transaction.category_id);
        if (!category || category.type !== selectedCategoryType) return false;
      }
      
      // Filter by selected categories (if any selected)
      if (selectedCategories.size > 0) {
        if (!transaction.category_id || !selectedCategories.has(transaction.category_id)) return false;
      }
      
      // Filter by payment method (if selected)
      if (selectedPaymentMethod) {
        if (transaction.payment_method !== selectedPaymentMethod) return false;
      }
      
      // Filter by paid_by (if selected)
      if (selectedPaidBy) {
        if (selectedPaidBy === 'null') {
          if (transaction.paid_by !== null) return false;
        } else {
          if (transaction.paid_by !== selectedPaidBy) return false;
        }
      }
      
      return true;
    });

    if (filteredTransactions.length === 0) {
      alert('No transactions match the current filters');
      return;
    }

    // Define CSV headers
    const headers = ['Date', 'Amount', 'Description', 'Category', 'Payment Method', 'Paid By', 'Year', 'Month', 'Quarter'];
    
    // Convert transactions to CSV rows
    const rows = filteredTransactions.map(transaction => {
      const category = categories.find(c => c.id === transaction.category_id);
      const categoryName = category?.name || '';
      
      const paidByOption = PAID_BY_OPTIONS.find(opt => opt.value === transaction.paid_by);
      const paidByLabel = paidByOption?.label || '';
      
      // Format date if available
      let dateStr = '';
      if (transaction.date) {
        try {
          dateStr = format(new Date(transaction.date), 'yyyy-MM-dd');
        } catch {
          dateStr = transaction.date;
        }
      }
      
      return [
        dateStr,
        transaction.amount.toString(),
        `"${transaction.description.replace(/"/g, '""')}"`, // Escape quotes in description
        categoryName,
        transaction.payment_method,
        paidByLabel,
        transaction.year.toString(),
        transaction.month?.toString() || '',
        transaction.quarter?.toString() || '',
      ];
    });
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with current filters
    const filterParts: string[] = [];
    if (selectedYear) filterParts.push(`year-${selectedYear}`);
    if (selectedCategoryType) filterParts.push(selectedCategoryType);
    if (selectedMonth) filterParts.push(`month-${selectedMonth}`);
    if (selectedQuarter) filterParts.push(`quarter-${selectedQuarter}`);
    if (selectedPaymentMethod) filterParts.push(`payment-${selectedPaymentMethod.replace(/\s+/g, '-')}`);
    const filterSuffix = filterParts.length > 0 ? `-${filterParts.join('-')}` : '';
    const filename = `transactions${filterSuffix}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      // Append multiple category IDs
      selectedCategories.forEach(categoryId => {
        params.append('category_id', categoryId);
      });
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
  }, [selectedYear, selectedMonth, selectedQuarter, selectedCategories, selectedPaymentMethod, selectedCategoryType, selectedPaidBy]);

  const loadBudgets = useCallback(async () => {
    try {
      const budgetsRes = await fetch(`/api/budgets?year=${selectedYear}`, {
        credentials: 'include',
      });
      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData);
      }
    } catch (error) {
      console.error('Failed to load budgets:', error);
    }
  }, [selectedYear]);

  const loadCategoryRules = useCallback(async () => {
    try {
      const res = await fetch('/api/category-rules', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setRules(data.rules || []);
      setBlocklist(data.blocklist || []);
    } catch (error) {
      console.error('Failed to load category rules:', error);
    }
  }, []);

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
      await loadBudgets();
      await loadCategoryRules();
      await loadTransactions();
      setInitialLoading(false);
    };
    
    initialLoad();
  }, [loadBudgets, loadCategoryRules, loadTransactions]);

  // Reload transactions when filters change (but not on initial mount)
  useEffect(() => {
    if (!initialLoading) {
      loadTransactions();
    }
  }, [loadTransactions, initialLoading]);

  useEffect(() => {
    if (!initialLoading) {
      loadBudgets();
    }
  }, [loadBudgets, initialLoading]);

  useEffect(() => {
    if (!initialLoading) {
      loadCategoryRules();
    }
  }, [loadCategoryRules, initialLoading]);

  const handleSuccess = () => {
    setShowForm(false);
    setEditingTransaction(null);
    loadTransactions();
  };

  const handleEdit = (transaction: Transaction) => {
    // Open modal instead of scrolling to top
    setEditingTransactionModal(transaction);
  };

  const handleDelete = (id: string) => {
    // Optimistically update local state; server delete is handled in TransactionList
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const matchesCurrentFilters = useCallback(
    (transaction: Transaction) => {
      if (transaction.year !== selectedYear) return false;

      if (selectedCategoryType) {
        const category = categories.find(c => c.id === transaction.category_id);
        if (!category || category.type !== selectedCategoryType) return false;
      }

      if (selectedCategoryType === 'monthly' && selectedMonth) {
        if (transaction.month !== parseInt(selectedMonth)) return false;
      }

      if (selectedCategoryType === 'quarterly' && selectedQuarter) {
        if (transaction.quarter !== parseInt(selectedQuarter)) return false;
      }

      if (selectedCategories.size > 0) {
        if (!transaction.category_id || !selectedCategories.has(transaction.category_id)) return false;
      }

      if (selectedPaymentMethod) {
        if (transaction.payment_method !== selectedPaymentMethod) return false;
      }

      if (selectedPaidBy) {
        if (selectedPaidBy === 'null') {
          if (transaction.paid_by !== null) return false;
        } else if (transaction.paid_by !== selectedPaidBy) {
          return false;
        }
      }

      return true;
    },
    [
      categories,
      selectedCategories,
      selectedCategoryType,
      selectedMonth,
      selectedPaidBy,
      selectedPaymentMethod,
      selectedQuarter,
      selectedYear,
    ]
  );

  const applyTransactionUpdate = useCallback(
    (transaction: Transaction) => {
      setTransactions(prev => {
        const matches = matchesCurrentFilters(transaction);
        const index = prev.findIndex(t => t.id === transaction.id);

        if (!matches) {
          if (index === -1) return prev;
          return prev.filter(t => t.id !== transaction.id);
        }

        if (index === -1) {
          return [transaction, ...prev];
        }

        const next = [...prev];
        next[index] = transaction;
        return next;
      });
    },
    [matchesCurrentFilters]
  );

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const activeSummaryMonth = selectedMonth ? parseInt(selectedMonth) : new Date().getMonth() + 1;
  const summaryMonthLabel = new Date(2000, activeSummaryMonth - 1).toLocaleString('default', { month: 'long' });
  const showMonthHint = !selectedMonth;

  const activeSummaryQuarter = selectedQuarter ? parseInt(selectedQuarter) : Math.floor(new Date().getMonth() / 3) + 1;
  const summaryQuarterLabel = `Q${activeSummaryQuarter}`;
  const showQuarterHint = !selectedQuarter;

  const uncategorizedCount = transactions.filter(t => t.category_id === null).length;

  // Close category filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target as Node)) {
        setCategoryFilterOpen(false);
      }
    };

    if (categoryFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [categoryFilterOpen]);

  // Get display text for category filter button
  const getCategoryFilterText = () => {
    if (selectedCategories.size === 0) {
      return 'All Categories';
    }
    if (selectedCategories.size === 1) {
      const categoryId = Array.from(selectedCategories)[0];
      const category = categories.find(c => c.id === categoryId);
      return category ? category.name : '1 category';
    }
    return `${selectedCategories.size} categories`;
  };

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
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={exportToCSV}
                  className="bg-blue-600 text-white px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap flex-1 sm:flex-none"
                  disabled={transactions.length === 0}
                >
                  Export CSV
                </button>
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
                loadTransactions();
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
                loadTransactions();
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

          <div className="relative" ref={categoryFilterRef}>
            <label className="block text-sm font-medium mb-1">
              Categories
            </label>
            <button
              type="button"
              onClick={() => setCategoryFilterOpen(!categoryFilterOpen)}
              className="w-full px-4 py-2 text-left border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
            >
              <span>{getCategoryFilterText()}</span>
              <span className="text-gray-400">{categoryFilterOpen ? '▲' : '▼'}</span>
            </button>
            {categoryFilterOpen && (
              <div className="absolute z-10 mt-1 w-full border rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
                <div className="p-3 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedCategories.size === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories(new Set());
                        }
                      }}
                      className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">All Categories</span>
                  </label>
                  {categories
                    .filter(cat => !selectedCategoryType || cat.type === selectedCategoryType)
                    .map((cat) => (
                      <label key={cat.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(cat.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedCategories);
                            if (e.target.checked) {
                              newSet.add(cat.id);
                            } else {
                              newSet.delete(cat.id);
                            }
                            setSelectedCategories(newSet);
                          }}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {cat.name} ({cat.type})
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
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
                categoryTypeFilter={selectedCategoryType}
                onMarkPaid={loadTransactions}
                defaultExpanded={false}
              />
              {/* Payments Made Summary */}
              <PaymentsMadeSummary
                transactions={transactions}
                categories={categories}
                categoryTypeFilter={selectedCategoryType}
                defaultExpanded={false}
              />
              <BudgetVsSpendingPanel
                transactions={transactions}
                categories={categories}
                budgets={budgets}
                period="month"
                year={selectedYear}
                periodValue={activeSummaryMonth}
                periodLabel={summaryMonthLabel}
                showPeriodHint={showMonthHint}
                enableGroupToggle
                defaultExpanded={false}
              />
              <BudgetVsSpendingPanel
                transactions={transactions}
                categories={categories}
                budgets={budgets}
                period="quarter"
                year={selectedYear}
                periodValue={activeSummaryQuarter}
                periodLabel={summaryQuarterLabel}
                showPeriodHint={showQuarterHint}
                defaultExpanded={false}
              />
              <BudgetVsSpendingPanel
                transactions={transactions}
                categories={categories}
                budgets={budgets}
                period="year"
                year={selectedYear}
                periodValue={null}
                periodLabel={`${selectedYear}`}
                defaultExpanded={false}
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

                   const createdTransaction = await response.json();
                   applyTransactionUpdate(createdTransaction);
                 }}
                 onTransactionUpdate={applyTransactionUpdate}
                 onRefresh={loadTransactions}
                 onSuggestCategories={() => setUncategorizedModalOpen(true)}
                 uncategorizedCount={uncategorizedCount}
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

        <UncategorizedAutoAssignModal
          isOpen={uncategorizedModalOpen}
          onClose={() => setUncategorizedModalOpen(false)}
          uncategorized={transactions.filter(t => t.category_id === null)}
          categories={categories}
          rules={rules}
          blocklist={blocklist}
          onTransactionUpdated={applyTransactionUpdate}
        />
      </div>
    </main>
  );
}

