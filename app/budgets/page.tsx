'use client';

import { useState, useEffect, useCallback } from 'react';
import { Budget, Category, CategoryType, ExpenseGroup } from '@/types/database';
import BudgetForm from '@/components/BudgetForm';

interface BudgetWithCategory extends Budget {
  category: Category;
}

type ExpenseGroupOption = ExpenseGroup | 'none';

interface CategoryFormState {
  name: string;
  type: CategoryType;
  default_budget: string;
  is_shared: boolean;
  expense_group: ExpenseGroupOption;
}

interface CategoryEditState extends CategoryFormState {
  id: string;
}

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  type: 'monthly',
  default_budget: '',
  is_shared: true,
  expense_group: 'variable',
};

const GROUP_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
  ignored: 'Ignored',
  none: 'Ungrouped',
};

const GROUP_PILL: Record<string, string> = {
  fixed: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
  variable: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  ignored: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
  none: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
};

const GROUP_OPTIONS: ExpenseGroupOption[] = ['fixed', 'variable', 'ignored', 'none'];

const FIELD = 'w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
const FIELD_LABEL = 'text-xs font-medium text-gray-500 uppercase tracking-wide';
const TH = 'px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider';

const toGroupPayload = (g: ExpenseGroupOption) => (g === 'none' ? null : g);

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [newCategoryForm, setNewCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [editingCategory, setEditingCategory] = useState<CategoryEditState | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingAmount, setEditingAmount] = useState<{ id: string; value: string } | null>(null);
  const [forwardCategory, setForwardCategory] = useState<{
    id: string;
    name: string;
    type: CategoryType;
    amount: string;
    fromYear: number;
    fromValue: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [categoriesRes, budgetsRes] = await Promise.all([
        fetch('/api/categories', { credentials: 'include' }),
        fetch(`/api/budgets?year=${selectedYear}`, { credentials: 'include' }),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBudgetSuccess = () => {
    setShowBudgetForm(false);
    setEditingBudget(null);
    loadData();
  };

  const handleEditBudget = (budget: BudgetWithCategory) => {
    setEditingBudget(budget);
    setShowBudgetForm(true);
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete budget');
      }

      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete budget');
    }
  };

  const handleCancelBudget = () => {
    setShowBudgetForm(false);
    setEditingBudget(null);
  };

  const saveCategory = async (payload: Record<string, any>, method: 'POST' | 'PATCH') => {
    const response = await fetch('/api/categories', {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save category');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    setCategoryError(null);

    try {
      await saveCategory(
        {
          name: newCategoryForm.name,
          type: newCategoryForm.type,
          default_budget: newCategoryForm.default_budget === '' ? null : parseFloat(newCategoryForm.default_budget),
          is_shared: newCategoryForm.is_shared,
          expense_group: toGroupPayload(newCategoryForm.expense_group),
        },
        'POST'
      );

      setNewCategoryForm(EMPTY_CATEGORY_FORM);
      await loadData();
    } catch (error: any) {
      setCategoryError(error.message || 'Failed to create category');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCategory) {
      return;
    }

    setCategorySaving(true);
    setCategoryError(null);

    try {
      await saveCategory(
        {
          id: editingCategory.id,
          name: editingCategory.name,
          type: editingCategory.type,
          default_budget: editingCategory.default_budget === '' ? null : parseFloat(editingCategory.default_budget),
          is_shared: editingCategory.is_shared,
          expense_group: toGroupPayload(editingCategory.expense_group),
        },
        'PATCH'
      );

      setEditingCategory(null);
      await loadData();
    } catch (error: any) {
      setCategoryError(error.message || 'Failed to update category');
    } finally {
      setCategorySaving(false);
    }
  };

  const startEditCategory = (category: Category) => {
    setCategoryError(null);
    setEditingCategory({
      id: category.id,
      name: category.name,
      type: category.type,
      default_budget: category.default_budget?.toString() || '',
      is_shared: category.is_shared,
      expense_group: (category.expense_group as ExpenseGroup) || 'none',
    });
  };

  const toggleArchiveCategory = async (category: Category) => {
    const archiving = !category.archived_at;
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id, archived: archiving }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update category');
      }
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to archive category');
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? Budgets under it will also be removed.`)) {
      return;
    }

    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
      }

      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete category. It may still be used by transactions.');
    }
  };

  const toggleCategoryShared = async (category: Category) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id, is_shared: !category.is_shared }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update scope');
      }

      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update category scope');
    }
  };

  const updateCategoryGroup = async (category: Category, group: ExpenseGroupOption) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, expense_group: toGroupPayload(group) } : c))
    );
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id, expense_group: toGroupPayload(group) }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update group');
      }
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update group');
      await loadData();
    }
  };

  const openForwardBudget = (category: Category) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const fromValue =
      category.type === 'quarterly' ? Math.ceil(month / 3) : category.type === 'yearly' ? 1 : month;
    setForwardCategory({
      id: category.id,
      name: category.name,
      type: category.type,
      amount: category.default_budget != null ? category.default_budget.toString() : '',
      fromYear: now.getFullYear(),
      fromValue,
    });
  };

  const applyForwardBudget = async () => {
    if (!forwardCategory) return;
    const amt = parseFloat(forwardCategory.amount);
    if (isNaN(amt) || amt < 0) {
      alert('Enter a valid amount');
      return;
    }
    const period =
      forwardCategory.type === 'quarterly' ? 'quarter' : forwardCategory.type === 'yearly' ? 'year' : 'month';
    setCategorySaving(true);
    try {
      const response = await fetch('/api/budgets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category_id: forwardCategory.id,
          amount: amt,
          period,
          from_year: forwardCategory.fromYear,
          from_value: forwardCategory.fromValue,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to apply budget');
      }
      setForwardCategory(null);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to apply budget');
    } finally {
      setCategorySaving(false);
    }
  };

  const saveBudgetAmount = async (budgetId: string, rawValue: string) => {
    const amount = parseFloat(rawValue);
    if (isNaN(amount) || amount < 0) {
      setEditingAmount(null);
      return;
    }
    setBudgets((prev) => prev.map((b) => (b.id === budgetId ? { ...b, amount } : b)));
    setEditingAmount(null);
    try {
      const response = await fetch(`/api/budgets/${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update budget');
      }
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update budget');
      await loadData();
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const getPeriodLabel = (budget: BudgetWithCategory) => {
    if (budget.period === 'year') return 'Yearly';

    if (budget.period === 'quarter') {
      if (budget.period_value) {
        const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        return `Quarterly - ${quarters[budget.period_value - 1]}`;
      }
      return 'Quarterly (All)';
    }

    if (budget.period_value) {
      const monthName = new Date(2000, budget.period_value - 1).toLocaleString('default', { month: 'long' });
      return `Monthly - ${monthName}`;
    }

    return 'Monthly (All)';
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Budgets &amp; Categories</h1>
            <p className="text-sm text-gray-500 mt-1">Manage categories, dashboard grouping, and budget targets — all in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {!showBudgetForm && (
              <button
                onClick={() => setShowBudgetForm(true)}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
              >
                + Assign Budget
              </button>
            )}
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Category setup</h2>
              <p className="text-sm text-gray-500 mt-1">&ldquo;Group&rdquo; controls the dashboard rollup — Fixed/Variable are tracked, Ignored is excluded. Archiving hides a category from new entries but keeps its history.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show archived
            </label>
          </div>

          <form onSubmit={handleCreateCategory} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end bg-gray-50 border border-gray-100 rounded-lg p-4">
            <div className="col-span-2 md:col-span-1">
              <label className={FIELD_LABEL}>Name</label>
              <input
                value={newCategoryForm.name}
                onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g. Groceries"
                className={FIELD}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Type</label>
              <select
                value={newCategoryForm.type}
                onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, type: e.target.value as CategoryType }))}
                className={FIELD}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Group</label>
              <select
                value={newCategoryForm.expense_group}
                onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, expense_group: e.target.value as ExpenseGroupOption }))}
                className={FIELD}
              >
                <option value="variable">Variable</option>
                <option value="fixed">Fixed</option>
                <option value="ignored">Ignored</option>
                <option value="none">Ungrouped</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Default $</label>
              <input
                type="number"
                step="0.01"
                value={newCategoryForm.default_budget}
                onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, default_budget: e.target.value }))}
                placeholder="0.00"
                className={FIELD}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Visibility</label>
              <select
                value={newCategoryForm.is_shared ? 'shared' : 'personal'}
                onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, is_shared: e.target.value === 'shared' }))}
                className={FIELD}
              >
                <option value="shared">Shared</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div>
              <button type="submit" disabled={categorySaving} className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors">
                {categorySaving ? 'Saving…' : '+ Add'}
              </button>
            </div>
          </form>

          {categoryError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{categoryError}</div>}

          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={TH}>Name</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Group</th>
                  <th className={`${TH} text-right`}>Default</th>
                  <th className={TH}>Visibility</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {categories
                  .filter((category) => showArchived || !category.archived_at)
                  .map((category) => (
                  <tr key={category.id} className={`transition-colors ${category.archived_at ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 text-sm font-medium">
                      {category.name}
                      {category.archived_at && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-600 align-middle">Archived</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{category.type}</td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={category.expense_group || 'none'}
                        onChange={(e) => updateCategoryGroup(category, e.target.value as ExpenseGroupOption)}
                        className={`appearance-none cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:ring-2 focus:ring-blue-400 ${GROUP_PILL[category.expense_group || 'none']}`}
                        title="How this category rolls up on the dashboard"
                      >
                        {GROUP_OPTIONS.map((g) => (
                          <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{category.default_budget === null || category.default_budget === undefined ? '—' : `$${category.default_budget.toFixed(2)}`}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleCategoryShared(category)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${category.is_shared ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                      >
                        {category.is_shared ? 'Shared' : 'Personal'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="inline-flex gap-3 text-sm font-medium">
                        <button onClick={() => openForwardBudget(category)} className="text-emerald-600 hover:text-emerald-800 transition-colors" title="Set this category's budget from now on, leaving past months untouched">Budget&nbsp;→</button>
                        <button onClick={() => startEditCategory(category)} className="text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                        <button onClick={() => toggleArchiveCategory(category)} className="text-gray-500 hover:text-gray-800 transition-colors">
                          {category.archived_at ? 'Unarchive' : 'Archive'}
                        </button>
                        <button onClick={() => deleteCategory(category)} className="text-red-600 hover:text-red-800 transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No categories found. Add one above to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showBudgetForm && (
          <div className="p-5 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editingBudget ? 'Edit Budget' : 'Assign New Budget'}</h2>
              <button onClick={handleCancelBudget} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
            </div>
            <BudgetForm categories={categories} year={selectedYear} onSuccess={handleBudgetSuccess} initialData={editingBudget || null} />
          </div>
        )}

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Budget targets · {selectedYear}</h2>
            {budgets.length > 0 && (
              <span className="text-xs text-gray-400">Tip: click an amount to edit it inline</span>
            )}
          </div>
        {budgets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No custom budgets yet — using each category&rsquo;s default budget for {selectedYear}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={TH}>Category</th>
                  <th className={TH}>Period</th>
                  <th className={`${TH} text-right`}>Budget Amount</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {budgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{budget.category.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getPeriodLabel(budget)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                      {editingAmount?.id === budget.id ? (
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={editingAmount.value}
                          onChange={(e) => setEditingAmount({ id: budget.id, value: e.target.value })}
                          onBlur={() => saveBudgetAmount(budget.id, editingAmount.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveBudgetAmount(budget.id, editingAmount.value);
                            if (e.key === 'Escape') setEditingAmount(null);
                          }}
                          className="w-28 text-right px-2 py-1 border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingAmount({ id: budget.id, value: parseFloat(budget.amount.toString()).toString() })}
                          className="px-2 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          title="Click to edit"
                        >
                          ${parseFloat(budget.amount.toString()).toFixed(2)}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-4">
                        <button onClick={() => handleEditBudget(budget)} className="text-blue-600 hover:text-blue-900">Edit</button>
                        <button onClick={() => handleDeleteBudget(budget.id)} className="text-red-600 hover:text-red-900">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </section>
      </div>

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Edit Category</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className={FIELD_LABEL}>Name</label>
                <input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                  required
                  className={FIELD}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>Type</label>
                  <select
                    value={editingCategory.type}
                    onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, type: e.target.value as CategoryType } : prev)}
                    className={FIELD}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className={FIELD_LABEL}>Visibility</label>
                  <select
                    value={editingCategory.is_shared ? 'shared' : 'personal'}
                    onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, is_shared: e.target.value === 'shared' } : prev)}
                    className={FIELD}
                  >
                    <option value="shared">Shared</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={FIELD_LABEL}>Group (dashboard rollup)</label>
                <select
                  value={editingCategory.expense_group}
                  onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, expense_group: e.target.value as ExpenseGroupOption } : prev)}
                  className={FIELD}
                >
                  <option value="variable">Variable (tracked)</option>
                  <option value="fixed">Fixed (tracked)</option>
                  <option value="ignored">Ignored (excluded)</option>
                  <option value="none">Ungrouped</option>
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL}>Default budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingCategory.default_budget}
                  onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, default_budget: e.target.value } : prev)}
                  className={FIELD}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySaving}
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
                >
                  {categorySaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {forwardCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-900">Set budget going forward</h3>
              <button
                type="button"
                onClick={() => setForwardCategory(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Applies to <span className="font-medium text-gray-700">{forwardCategory.name}</span> from the
              selected {forwardCategory.type === 'yearly' ? 'year' : forwardCategory.type === 'quarterly' ? 'quarter' : 'month'} onward
              (and all future years). Earlier periods are left exactly as they are.
            </p>

            <div className="space-y-4">
              <div>
                <label className={FIELD_LABEL}>Budget amount</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={forwardCategory.amount}
                  onChange={(e) => setForwardCategory((prev) => prev ? { ...prev, amount: e.target.value } : prev)}
                  placeholder="0.00"
                  className={FIELD}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {forwardCategory.type !== 'yearly' && (
                  <div>
                    <label className={FIELD_LABEL}>Starting {forwardCategory.type === 'quarterly' ? 'quarter' : 'month'}</label>
                    <select
                      value={forwardCategory.fromValue}
                      onChange={(e) => setForwardCategory((prev) => prev ? { ...prev, fromValue: parseInt(e.target.value) } : prev)}
                      className={FIELD}
                    >
                      {forwardCategory.type === 'quarterly'
                        ? [1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)
                        : Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                          ))}
                    </select>
                  </div>
                )}
                <div className={forwardCategory.type === 'yearly' ? 'col-span-2' : ''}>
                  <label className={FIELD_LABEL}>Starting year</label>
                  <select
                    value={forwardCategory.fromYear}
                    onChange={(e) => setForwardCategory((prev) => prev ? { ...prev, fromYear: parseInt(e.target.value) } : prev)}
                    className={FIELD}
                  >
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={() => setForwardCategory(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyForwardBudget}
                disabled={categorySaving}
                className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors"
              >
                {categorySaving ? 'Applying…' : 'Apply going forward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
