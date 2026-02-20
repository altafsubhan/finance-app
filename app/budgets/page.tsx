'use client';

import { useState, useEffect, useCallback } from 'react';
import { Budget, Category, CategoryType } from '@/types/database';
import BudgetForm from '@/components/BudgetForm';

interface BudgetWithCategory extends Budget {
  category: Category;
}

interface CategoryFormState {
  id?: string;
  name: string;
  type: CategoryType;
  default_budget: string;
  is_shared: boolean;
}

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  type: 'monthly',
  default_budget: '',
  is_shared: true,
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

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

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    setCategoryError(null);

    try {
      const payload = {
        id: categoryForm.id,
        name: categoryForm.name,
        type: categoryForm.type,
        default_budget: categoryForm.default_budget === '' ? null : parseFloat(categoryForm.default_budget),
        is_shared: categoryForm.is_shared,
      };

      const response = await fetch('/api/categories', {
        method: categoryForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save category');
      }

      setCategoryForm(EMPTY_CATEGORY_FORM);
      await loadData();
    } catch (error: any) {
      setCategoryError(error.message || 'Failed to save category');
    } finally {
      setCategorySaving(false);
    }
  };

  const startEditCategory = (category: Category) => {
    setCategoryError(null);
    setCategoryForm({
      id: category.id,
      name: category.name,
      type: category.type,
      default_budget: category.default_budget?.toString() || '',
      is_shared: category.is_shared,
    });
  };

  const cancelEditCategory = () => {
    setCategoryError(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
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

      if (categoryForm.id === category.id) {
        setCategoryForm(EMPTY_CATEGORY_FORM);
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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const getPeriodLabel = (budget: BudgetWithCategory) => {
    if (budget.period === 'year') {
      return 'Yearly';
    }

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
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Budgets &amp; Categories</h1>
            <p className="text-gray-600 mt-2">Manage categories (including shared/private), default budgets, and yearly budget targets in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {!showBudgetForm && (
              <button
                onClick={() => setShowBudgetForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add Budget
              </button>
            )}
          </div>
        </div>

        <section className="bg-white border rounded-lg p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Category setup</h2>
            <p className="text-sm text-gray-600 mt-1">Add, edit, delete, and toggle category privacy. Default budget is used as your baseline planning amount.</p>
          </div>

          <form onSubmit={handleCategorySubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                value={categoryForm.type}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, type: e.target.value as CategoryType }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Default budget</label>
              <input
                type="number"
                step="0.01"
                value={categoryForm.default_budget}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, default_budget: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Visibility</label>
              <select
                value={categoryForm.is_shared ? 'shared' : 'personal'}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, is_shared: e.target.value === 'shared' }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              >
                <option value="shared">Shared</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={categorySaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {categorySaving ? 'Saving...' : categoryForm.id ? 'Update' : 'Add'}
              </button>
              {categoryForm.id && (
                <button type="button" onClick={cancelEditCategory} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Cancel</button>
              )}
            </div>
          </form>

          {categoryError && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded">{categoryError}</div>}

          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Default</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3 text-sm font-medium">{category.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{category.type}</td>
                    <td className="px-4 py-3 text-sm text-right">{category.default_budget === null ? '—' : `$${category.default_budget.toFixed(2)}`}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleCategoryShared(category)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${category.is_shared ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                      >
                        {category.is_shared ? 'Shared' : 'Personal'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="inline-flex gap-3">
                        <button onClick={() => startEditCategory(category)} className="text-blue-600 hover:text-blue-800">Edit</button>
                        <button onClick={() => deleteCategory(category)} className="text-red-600 hover:text-red-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No categories found. Add one above to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showBudgetForm && (
          <div className="p-6 bg-white border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">{editingBudget ? 'Edit Budget' : 'New Budget'}</h2>
              <button onClick={handleCancelBudget} className="text-gray-600 hover:text-gray-900">Cancel</button>
            </div>
            <BudgetForm categories={categories} year={selectedYear} onSuccess={handleBudgetSuccess} initialData={editingBudget || null} />
          </div>
        )}

        {budgets.length === 0 ? (
          <div className="text-center py-12 bg-white border rounded-lg">
            <p className="text-gray-600 mb-4">No budgets set for {selectedYear}.</p>
            <p className="text-gray-500">Click &quot;Add Budget&quot; to create one.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budget Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{budget.category.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getPeriodLabel(budget)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">${parseFloat(budget.amount.toString()).toFixed(2)}</td>
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
      </div>
    </main>
  );
}
