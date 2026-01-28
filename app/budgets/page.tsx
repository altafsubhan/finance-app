'use client';

import { useState, useEffect } from 'react';
import { Budget, Category } from '@/types/database';
import BudgetForm from '@/components/BudgetForm';

interface BudgetWithCategory extends Budget {
  category: Category;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [selectedYear]);

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

      // Load budgets
      const budgetsRes = await fetch(`/api/budgets?year=${selectedYear}`, {
        credentials: 'include',
      });
      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingBudget(null);
    loadData();
  };

  const handleEdit = (budget: BudgetWithCategory) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete budget');
      }

      loadData();
    } catch (error) {
      alert('Failed to delete budget');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const getPeriodLabel = (budget: BudgetWithCategory) => {
    if (budget.period === 'year') {
      return 'Yearly';
    } else if (budget.period === 'quarter') {
      if (budget.period_value) {
        const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        return `Quarterly - ${quarters[budget.period_value - 1]}`;
      }
      return 'Quarterly (All)';
    } else {
      if (budget.period_value) {
        const monthName = new Date(2000, budget.period_value - 1).toLocaleString('default', { month: 'long' });
        return `Monthly - ${monthName}`;
      }
      return 'Monthly (All)';
    }
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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Budgets &amp; Categories</h1>
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add Budget
              </button>
            )}
          </div>
        </div>

        {/* Categories overview (read-only) */}
        {categories.length > 0 && (
          <div className="mb-10 space-y-6">
            <h2 className="text-2xl font-semibold">Categories</h2>
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-2">Monthly</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories
                    .filter((c) => c.type === 'monthly')
                    .map((cat) => (
                      <div key={cat.id} className="p-4 border rounded-lg bg-white">
                        <div className="font-medium">{cat.name}</div>
                        {cat.default_budget && (
                          <div className="text-sm text-gray-500">
                            Default Budget: ${parseFloat(cat.default_budget.toString()).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">Quarterly</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories
                    .filter((c) => c.type === 'quarterly')
                    .map((cat) => (
                      <div key={cat.id} className="p-4 border rounded-lg bg-white">
                        <div className="font-medium">{cat.name}</div>
                        {cat.default_budget && (
                          <div className="text-sm text-gray-500">
                            Default Budget: ${parseFloat(cat.default_budget.toString()).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">Yearly</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories
                    .filter((c) => c.type === 'yearly')
                    .map((cat) => (
                      <div key={cat.id} className="p-4 border rounded-lg bg-white">
                        <div className="font-medium">{cat.name}</div>
                        {cat.default_budget && (
                          <div className="text-sm text-gray-500">
                            Default Budget: ${parseFloat(cat.default_budget.toString()).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {showForm && (
          <div className="mb-8 p-6 bg-white border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">
                {editingBudget ? 'Edit Budget' : 'New Budget'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            <BudgetForm
              categories={categories}
              year={selectedYear}
              onSuccess={handleSuccess}
              initialData={editingBudget || null}
            />
          </div>
        )}

        {budgets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No budgets set for {selectedYear}.</p>
            <p className="text-gray-500">Click &quot;Add Budget&quot; to create your first budget.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {budget.category.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getPeriodLabel(budget)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                      ${parseFloat(budget.amount.toString()).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-4">
                        <button
                          onClick={() => handleEdit(budget)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(budget.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
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

