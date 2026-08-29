'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

interface CellEditorState {
  categoryId: string;
  categoryName: string;
  period: 'month' | 'quarter' | 'year';
  periodValue: number | null;
  periodLabel: string;
  amount: string;
  expenseGroupOverride: ExpenseGroupOption | 'inherit';
  budgetId: string | null;
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

const GROUP_DOT: Record<string, string> = {
  fixed: 'bg-indigo-400',
  variable: 'bg-emerald-400',
  ignored: 'bg-gray-300',
  none: 'bg-amber-400',
};

const GROUP_OPTIONS: ExpenseGroupOption[] = ['fixed', 'variable', 'ignored', 'none'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FIELD = 'w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
const FIELD_LABEL = 'text-xs font-medium text-gray-500 uppercase tracking-wide';
const TH = 'px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider';

const toGroupPayload = (g: ExpenseGroupOption) => (g === 'none' ? null : g);

function getEffectiveCellData(
  category: Category,
  budgets: Budget[],
  year: number,
  period: 'month' | 'quarter' | 'year',
  periodValue: number | null
): { amount: number | null; expenseGroup: ExpenseGroup | null; hasOverride: boolean; budgetId: string | null } {
  const matching = budgets.filter(
    (b) => b.category_id === category.id && b.year === year && b.period === period
  );

  // Period-specific row first
  if (periodValue !== null) {
    const specific = matching.find((b) => b.period_value === periodValue);
    if (specific) return {
      amount: parseFloat(specific.amount.toString()),
      expenseGroup: (specific.expense_group as ExpenseGroup) ?? null,
      hasOverride: true,
      budgetId: specific.id,
    };
  }

  // General row (period_value = null)
  const general = matching.find((b) => b.period_value === null);
  if (general) return {
    amount: parseFloat(general.amount.toString()),
    expenseGroup: (general.expense_group as ExpenseGroup) ?? null,
    hasOverride: true,
    budgetId: general.id,
  };

  return {
    amount: category.default_budget != null ? parseFloat(category.default_budget.toString()) : null,
    expenseGroup: (category.expense_group as ExpenseGroup) ?? null,
    hasOverride: false,
    budgetId: null,
  };
}

function periodLabel(period: 'month' | 'quarter' | 'year', value: number | null): string {
  if (period === 'month' && value) return MONTH_LONG[value - 1];
  if (period === 'quarter' && value) return `Q${value}`;
  return 'Yearly';
}

function computeForwardPreview(
  period: 'month' | 'quarter' | 'year',
  fromYear: number,
  fromValue: number,
  horizon: 'year' | 'indefinite'
): { label: string; count: number; throughYear: number } {
  const endYear = horizon === 'year' ? fromYear : fromYear + 10;
  const maxPerYear = period === 'month' ? 12 : period === 'quarter' ? 4 : 1;
  let count = 0;
  for (let y = fromYear; y <= endYear; y++) {
    const start = y === fromYear ? fromValue : 1;
    count += maxPerYear - start + 1;
  }
  const endLabel = period === 'month'
    ? `${MONTHS[maxPerYear - 1]} ${endYear}`
    : period === 'quarter'
    ? `Q${maxPerYear} ${endYear}`
    : `${endYear}`;
  const startLabel = period === 'month'
    ? `${MONTHS[fromValue - 1]} ${fromYear}`
    : period === 'quarter'
    ? `Q${fromValue} ${fromYear}`
    : `${fromYear}`;
  return { label: `${startLabel} → ${endLabel}`, count, throughYear: endYear };
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'categories' | 'timeline'>('timeline');

  const [newCategoryForm, setNewCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [editingCategory, setEditingCategory] = useState<CategoryEditState | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingAmount, setEditingAmount] = useState<{ id: string; value: string } | null>(null);

  // Cell editor (timeline)
  const [editingCell, setEditingCell] = useState<CellEditorState | null>(null);
  const [cellSaving, setCellSaving] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);

  // Forward modal
  const [forwardCategory, setForwardCategory] = useState<{
    id: string;
    name: string;
    type: CategoryType;
    amount: string;
    fromYear: number;
    fromValue: number;
    horizon: 'year' | 'indefinite';
    expenseGroupOverride: ExpenseGroupOption | 'inherit';
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesRes, budgetsRes, allBudgetsRes] = await Promise.all([
        fetch('/api/categories', { credentials: 'include' }),
        fetch(`/api/budgets?year=${selectedYear}`, { credentials: 'include' }),
        fetch(`/api/budgets`, { credentials: 'include' }),
      ]);

      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (budgetsRes.ok) setBudgets(await budgetsRes.json());
      if (allBudgetsRes.ok) setAllBudgets(await allBudgetsRes.json());
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Category CRUD ──

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
      await saveCategory({
        name: newCategoryForm.name,
        type: newCategoryForm.type,
        default_budget: newCategoryForm.default_budget === '' ? null : parseFloat(newCategoryForm.default_budget),
        is_shared: newCategoryForm.is_shared,
        expense_group: toGroupPayload(newCategoryForm.expense_group),
      }, 'POST');
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
    if (!editingCategory) return;
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await saveCategory({
        id: editingCategory.id,
        name: editingCategory.name,
        type: editingCategory.type,
        default_budget: editingCategory.default_budget === '' ? null : parseFloat(editingCategory.default_budget),
        is_shared: editingCategory.is_shared,
        expense_group: toGroupPayload(editingCategory.expense_group),
      }, 'PATCH');
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
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id, archived: !category.archived_at }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update');
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to archive category');
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? Budgets under it will also be removed.`)) return;
    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete');
      if (editingCategory?.id === category.id) setEditingCategory(null);
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
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update scope');
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update category scope');
    }
  };

  const updateCategoryGroup = async (category: Category, group: ExpenseGroupOption) => {
    setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, expense_group: toGroupPayload(group) } : c)));
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: category.id, expense_group: toGroupPayload(group) }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update group');
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update group');
      await loadData();
    }
  };

  // ── Budget CRUD ──

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Delete this budget override?')) return;
    try {
      const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete');
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete budget');
    }
  };

  const saveBudgetAmount = async (budgetId: string, rawValue: string) => {
    const amount = parseFloat(rawValue);
    if (isNaN(amount) || amount < 0) { setEditingAmount(null); return; }
    setBudgets((prev) => prev.map((b) => (b.id === budgetId ? { ...b, amount } : b)));
    setEditingAmount(null);
    try {
      const response = await fetch(`/api/budgets/${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update');
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update budget');
      await loadData();
    }
  };

  // ── Cell editor ──

  const openCellEditor = (category: Category, period: 'month' | 'quarter' | 'year', periodValue: number | null) => {
    const catPeriod: 'month' | 'quarter' | 'year' = category.type === 'monthly' ? 'month' : category.type === 'quarterly' ? 'quarter' : 'year';
    const cell = getEffectiveCellData(category, allBudgets, selectedYear, catPeriod, periodValue);
    const label = periodLabel(catPeriod, periodValue);
    setEditingCell({
      categoryId: category.id,
      categoryName: category.name,
      period: catPeriod,
      periodValue,
      periodLabel: label,
      amount: cell.amount != null ? cell.amount.toString() : '',
      expenseGroupOverride: cell.hasOverride && cell.expenseGroup ? cell.expenseGroup : 'inherit',
      budgetId: cell.budgetId,
    });
    setCellError(null);
  };

  const saveCellEditor = async (fillToYearEnd = false, applyForward = false) => {
    if (!editingCell) return;
    const amt = parseFloat(editingCell.amount);
    if (isNaN(amt) || amt < 0) { setCellError('Enter a valid amount'); return; }
    setCellSaving(true);
    setCellError(null);
    try {
      const expenseGroup = editingCell.expenseGroupOverride === 'inherit' ? undefined : toGroupPayload(editingCell.expenseGroupOverride as ExpenseGroupOption);

      if (fillToYearEnd) {
        // Fill from this period to year end
        const maxValue = editingCell.period === 'month' ? 12 : editingCell.period === 'quarter' ? 4 : 1;
        const startValue = editingCell.periodValue ?? 1;
        const body: Record<string, unknown> = {
          category_id: editingCell.categoryId,
          amount: amt,
          period: editingCell.period,
          from_year: selectedYear,
          from_value: startValue,
          through_year: selectedYear,
        };
        if (expenseGroup !== undefined) body.expense_group = expenseGroup;
        const res = await fetch('/api/budgets/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to apply');
        setEditingCell(null);
        await loadData();
        return;
      }

      if (applyForward) {
        setEditingCell(null);
        openForwardBudget(
          categories.find((c) => c.id === editingCell.categoryId)!,
          editingCell.periodValue,
          editingCell.amount,
          editingCell.expenseGroupOverride
        );
        return;
      }

      const body: Record<string, unknown> = {
        category_id: editingCell.categoryId,
        year: selectedYear,
        period: editingCell.period,
        period_value: editingCell.periodValue,
        amount: amt,
      };
      if (expenseGroup !== undefined) body.expense_group = expenseGroup;

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setEditingCell(null);
      await loadData();
    } catch (error: any) {
      setCellError(error.message || 'Failed to save budget');
    } finally {
      setCellSaving(false);
    }
  };

  const deleteCellOverride = async () => {
    if (!editingCell?.budgetId) { setEditingCell(null); return; }
    setCellSaving(true);
    try {
      const res = await fetch(`/api/budgets/${editingCell.budgetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      setEditingCell(null);
      await loadData();
    } catch (error: any) {
      setCellError(error.message || 'Failed to delete override');
    } finally {
      setCellSaving(false);
    }
  };

  // ── Forward budget modal ──

  const openForwardBudget = (
    category: Category,
    fromValue?: number | null,
    amountOverride?: string,
    groupOverride?: ExpenseGroupOption | 'inherit'
  ) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const defaultFromValue = fromValue != null
      ? fromValue
      : category.type === 'quarterly' ? Math.ceil(month / 3) : category.type === 'yearly' ? 1 : month;
    setForwardCategory({
      id: category.id,
      name: category.name,
      type: category.type,
      amount: amountOverride ?? (category.default_budget != null ? category.default_budget.toString() : ''),
      fromYear: now.getFullYear(),
      fromValue: defaultFromValue,
      horizon: 'indefinite',
      expenseGroupOverride: groupOverride ?? 'inherit',
    });
  };

  const applyForwardBudget = async () => {
    if (!forwardCategory) return;
    const amt = parseFloat(forwardCategory.amount);
    if (isNaN(amt) || amt < 0) { alert('Enter a valid amount'); return; }
    const period: 'month' | 'quarter' | 'year' =
      forwardCategory.type === 'quarterly' ? 'quarter' : forwardCategory.type === 'yearly' ? 'year' : 'month';
    setCategorySaving(true);
    try {
      const preview = computeForwardPreview(period, forwardCategory.fromYear, forwardCategory.fromValue, forwardCategory.horizon);
      const body: Record<string, unknown> = {
        category_id: forwardCategory.id,
        amount: amt,
        period,
        from_year: forwardCategory.fromYear,
        from_value: forwardCategory.fromValue,
        through_year: preview.throughYear,
      };
      if (forwardCategory.expenseGroupOverride !== 'inherit') {
        body.expense_group = toGroupPayload(forwardCategory.expenseGroupOverride as ExpenseGroupOption);
      }
      const response = await fetch('/api/budgets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to apply budget');
      setForwardCategory(null);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to apply budget');
    } finally {
      setCategorySaving(false);
    }
  };

  // ── Helpers ──

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const getPeriodLabel = (budget: BudgetWithCategory) => {
    if (budget.period === 'year') return 'Yearly';
    if (budget.period === 'quarter') {
      if (budget.period_value) return `Q${budget.period_value} (${['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][budget.period_value - 1]})`;
      return 'Quarterly (All)';
    }
    if (budget.period_value) return MONTH_LONG[budget.period_value - 1];
    return 'Monthly (All)';
  };

  const activeCategories = categories.filter((c) => showArchived || !c.archived_at);
  const monthlyCategories = activeCategories.filter((c) => c.type === 'monthly');
  const quarterlyCategories = activeCategories.filter((c) => c.type === 'quarterly');
  const yearlyCategories = activeCategories.filter((c) => c.type === 'yearly');

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto"><div className="text-center py-12">Loading…</div></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Budgets &amp; Categories</h1>
            <p className="text-sm text-gray-500 mt-1">Manage categories and set budget targets by period.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            {activeTab === 'timeline' && (
              <button
                onClick={() => { setEditingBudget(null); setShowBudgetForm(true); }}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
              >
                + Assign Budget
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200">
          {(['timeline', 'categories'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab === 'timeline' ? 'Budget Timeline' : 'Categories'}
            </button>
          ))}
        </div>

        {/* ── TIMELINE TAB ── */}
        {activeTab === 'timeline' && (
          <>
            {showBudgetForm && (
              <div className="p-5 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{editingBudget ? 'Edit Budget' : 'Assign New Budget'}</h2>
                  <button onClick={() => { setShowBudgetForm(false); setEditingBudget(null); }} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                </div>
                <BudgetForm
                  categories={categories}
                  year={selectedYear}
                  onSuccess={() => { setShowBudgetForm(false); setEditingBudget(null); loadData(); }}
                  initialData={editingBudget || null}
                />
              </div>
            )}

            {/* Monthly timeline */}
            {monthlyCategories.length > 0 && (
              <TimelineSection
                title="Monthly"
                accentClass="bg-blue-100 text-blue-700"
                categories={monthlyCategories}
                period="month"
                columns={Array.from({ length: 12 }, (_, i) => ({ label: MONTHS[i], value: i + 1 }))}
                allBudgets={allBudgets}
                selectedYear={selectedYear}
                onOpenCell={openCellEditor}
                onOpenForward={openForwardBudget}
              />
            )}

            {/* Quarterly timeline */}
            {quarterlyCategories.length > 0 && (
              <TimelineSection
                title="Quarterly"
                accentClass="bg-purple-100 text-purple-700"
                categories={quarterlyCategories}
                period="quarter"
                columns={[1, 2, 3, 4].map((q) => ({ label: `Q${q}`, value: q }))}
                allBudgets={allBudgets}
                selectedYear={selectedYear}
                onOpenCell={openCellEditor}
                onOpenForward={openForwardBudget}
              />
            )}

            {/* Yearly timeline */}
            {yearlyCategories.length > 0 && (
              <TimelineSection
                title="Yearly"
                accentClass="bg-orange-100 text-orange-700"
                categories={yearlyCategories}
                period="year"
                columns={[{ label: `${selectedYear}`, value: null }]}
                allBudgets={allBudgets}
                selectedYear={selectedYear}
                onOpenCell={openCellEditor}
                onOpenForward={openForwardBudget}
              />
            )}

            {/* Budget targets list */}
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">All overrides · {selectedYear}</h2>
                {budgets.length > 0 && <span className="text-xs text-gray-400">Click an amount to edit inline</span>}
              </div>
              {budgets.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">No custom overrides — cells are using category defaults.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={TH}>Category</th>
                        <th className={TH}>Period</th>
                        <th className={`${TH} text-right`}>Amount</th>
                        <th className={TH}>Group</th>
                        <th className={`${TH} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {budgets.map((budget) => (
                        <tr key={budget.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{budget.category.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{getPeriodLabel(budget)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-right text-gray-900">
                            {editingAmount?.id === budget.id ? (
                              <input
                                type="number" step="0.01" autoFocus
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
                          <td className="px-6 py-4 text-sm">
                            {budget.expense_group ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${GROUP_PILL[budget.expense_group]}`}>
                                {GROUP_LABELS[budget.expense_group]}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">From category</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => { setEditingBudget(budget); setShowBudgetForm(true); }} className="text-blue-600 hover:text-blue-900">Edit</button>
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
          </>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === 'categories' && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Category setup</h2>
                <p className="text-sm text-gray-500 mt-1">&ldquo;Group&rdquo; controls the dashboard rollup — Fixed/Variable are tracked, Ignored is excluded.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Show archived
              </label>
            </div>

            <form onSubmit={handleCreateCategory} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end bg-gray-50 border border-gray-100 rounded-lg p-4">
              <div className="col-span-2 md:col-span-1">
                <label className={FIELD_LABEL}>Name</label>
                <input value={newCategoryForm.name} onChange={(e) => setNewCategoryForm((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Groceries" className={FIELD} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Type</label>
                <select value={newCategoryForm.type} onChange={(e) => setNewCategoryForm((p) => ({ ...p, type: e.target.value as CategoryType }))} className={FIELD}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Group</label>
                <select value={newCategoryForm.expense_group} onChange={(e) => setNewCategoryForm((p) => ({ ...p, expense_group: e.target.value as ExpenseGroupOption }))} className={FIELD}>
                  <option value="variable">Variable</option>
                  <option value="fixed">Fixed</option>
                  <option value="ignored">Ignored</option>
                  <option value="none">Ungrouped</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Default $</label>
                <input type="number" step="0.01" value={newCategoryForm.default_budget} onChange={(e) => setNewCategoryForm((p) => ({ ...p, default_budget: e.target.value }))} placeholder="0.00" className={FIELD} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Visibility</label>
                <select value={newCategoryForm.is_shared ? 'shared' : 'personal'} onChange={(e) => setNewCategoryForm((p) => ({ ...p, is_shared: e.target.value === 'shared' }))} className={FIELD}>
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
                  {activeCategories.map((category) => (
                    <tr key={category.id} className={`transition-colors ${category.archived_at ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm font-medium">
                        {category.name}
                        {category.archived_at && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-600">Archived</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{category.type}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={category.expense_group || 'none'}
                          onChange={(e) => updateCategoryGroup(category, e.target.value as ExpenseGroupOption)}
                          className={`appearance-none cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:ring-2 focus:ring-blue-400 ${GROUP_PILL[category.expense_group || 'none']}`}
                        >
                          {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{category.default_budget == null ? '—' : `$${parseFloat(category.default_budget.toString()).toFixed(2)}`}</td>
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
                          <button onClick={() => { openForwardBudget(category); setActiveTab('timeline'); }} className="text-emerald-600 hover:text-emerald-800 transition-colors">Budget →</button>
                          <button onClick={() => startEditCategory(category)} className="text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                          <button onClick={() => toggleArchiveCategory(category)} className="text-gray-500 hover:text-gray-800 transition-colors">{category.archived_at ? 'Unarchive' : 'Archive'}</button>
                          <button onClick={() => deleteCategory(category)} className="text-red-600 hover:text-red-800 transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeCategories.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No categories found. Add one above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* ── Edit Category Modal ── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Edit Category</h3>
              <button onClick={() => setEditingCategory(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className={FIELD_LABEL}>Name</label>
                <input value={editingCategory.name} onChange={(e) => setEditingCategory((p) => p ? { ...p, name: e.target.value } : p)} required className={FIELD} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>Type</label>
                  <select value={editingCategory.type} onChange={(e) => setEditingCategory((p) => p ? { ...p, type: e.target.value as CategoryType } : p)} className={FIELD}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Visibility</label>
                  <select value={editingCategory.is_shared ? 'shared' : 'personal'} onChange={(e) => setEditingCategory((p) => p ? { ...p, is_shared: e.target.value === 'shared' } : p)} className={FIELD}>
                    <option value="shared">Shared</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={FIELD_LABEL}>Group (dashboard rollup)</label>
                <select value={editingCategory.expense_group} onChange={(e) => setEditingCategory((p) => p ? { ...p, expense_group: e.target.value as ExpenseGroupOption } : p)} className={FIELD}>
                  <option value="variable">Variable (tracked)</option>
                  <option value="fixed">Fixed (tracked)</option>
                  <option value="ignored">Ignored (excluded)</option>
                  <option value="none">Ungrouped</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Default budget</label>
                <input type="number" step="0.01" value={editingCategory.default_budget} onChange={(e) => setEditingCategory((p) => p ? { ...p, default_budget: e.target.value } : p)} className={FIELD} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={categorySaving} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {categorySaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cell Editor Modal ── */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-gray-900">{editingCell.categoryName}</h3>
              <button onClick={() => setEditingCell(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{editingCell.periodLabel} · {selectedYear}</p>

            <div className="space-y-3">
              <div>
                <label className={FIELD_LABEL}>Budget amount</label>
                <input
                  type="number" step="0.01" autoFocus
                  value={editingCell.amount}
                  onChange={(e) => setEditingCell((p) => p ? { ...p, amount: e.target.value } : p)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveCellEditor(); }}
                  placeholder="0.00"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Group override</label>
                <select
                  value={editingCell.expenseGroupOverride}
                  onChange={(e) => setEditingCell((p) => p ? { ...p, expenseGroupOverride: e.target.value as ExpenseGroupOption | 'inherit' } : p)}
                  className={FIELD}
                >
                  <option value="inherit">Inherit from category</option>
                  <option value="fixed">Fixed</option>
                  <option value="variable">Variable</option>
                  <option value="ignored">Ignored</option>
                </select>
              </div>
            </div>

            {cellError && <p className="mt-2 text-xs text-red-600">{cellError}</p>}

            <div className="mt-4 space-y-2">
              <button
                onClick={() => saveCellEditor(false, false)}
                disabled={cellSaving}
                className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {cellSaving ? 'Saving…' : 'Save this period'}
              </button>
              <button
                onClick={() => saveCellEditor(true, false)}
                disabled={cellSaving}
                className="w-full bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Fill to year-end
              </button>
              <button
                onClick={() => saveCellEditor(false, true)}
                disabled={cellSaving}
                className="w-full bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Apply going forward…
              </button>
              {editingCell.budgetId && (
                <button
                  onClick={deleteCellOverride}
                  disabled={cellSaving}
                  className="w-full text-sm text-red-600 hover:text-red-800 py-1"
                >
                  Remove override (revert to default)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Forward Budget Modal ── */}
      {forwardCategory && (() => {
        const period: 'month' | 'quarter' | 'year' =
          forwardCategory.type === 'quarterly' ? 'quarter' : forwardCategory.type === 'yearly' ? 'year' : 'month';
        const preview = computeForwardPreview(period, forwardCategory.fromYear, forwardCategory.fromValue, forwardCategory.horizon);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900">Set budget going forward</h3>
                <button onClick={() => setForwardCategory(null)} className="text-gray-400 hover:text-gray-700">✕</button>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Category: <span className="font-medium text-gray-700">{forwardCategory.name}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className={FIELD_LABEL}>Budget amount</label>
                  <input
                    type="number" step="0.01" autoFocus
                    value={forwardCategory.amount}
                    onChange={(e) => setForwardCategory((p) => p ? { ...p, amount: e.target.value } : p)}
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
                        onChange={(e) => setForwardCategory((p) => p ? { ...p, fromValue: parseInt(e.target.value) } : p)}
                        className={FIELD}
                      >
                        {forwardCategory.type === 'quarterly'
                          ? [1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)
                          : MONTH_LONG.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                  )}
                  <div className={forwardCategory.type === 'yearly' ? 'col-span-2' : ''}>
                    <label className={FIELD_LABEL}>Starting year</label>
                    <select
                      value={forwardCategory.fromYear}
                      onChange={(e) => setForwardCategory((p) => p ? { ...p, fromYear: parseInt(e.target.value) } : p)}
                      className={FIELD}
                    >
                      {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={FIELD_LABEL}>Apply through</label>
                  <div className="mt-1.5 flex gap-3">
                    {(['year', 'indefinite'] as const).map((h) => (
                      <label key={h} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={forwardCategory.horizon === h}
                          onChange={() => setForwardCategory((p) => p ? { ...p, horizon: h } : p)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{h === 'year' ? `End of ${forwardCategory.fromYear}` : 'Indefinitely (10 years)'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={FIELD_LABEL}>Group override (optional)</label>
                  <select
                    value={forwardCategory.expenseGroupOverride}
                    onChange={(e) => setForwardCategory((p) => p ? { ...p, expenseGroupOverride: e.target.value as ExpenseGroupOption | 'inherit' } : p)}
                    className={FIELD}
                  >
                    <option value="inherit">Keep category default</option>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                    <option value="ignored">Ignored</option>
                  </select>
                </div>

                {/* Preview */}
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                  <span className="font-medium text-blue-800">
                    ${isNaN(parseFloat(forwardCategory.amount)) ? '—' : parseFloat(forwardCategory.amount).toFixed(2)}
                  </span>
                  <span className="text-blue-700"> applied to {preview.label}</span>
                  <span className="text-blue-500 ml-1">({preview.count} period{preview.count !== 1 ? 's' : ''})</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5">
                <button type="button" onClick={() => setForwardCategory(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
                <button
                  type="button"
                  onClick={applyForwardBudget}
                  disabled={categorySaving}
                  className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {categorySaving ? 'Applying…' : 'Apply going forward'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

// ── Timeline Section ──

interface TimelineSectionProps {
  title: string;
  accentClass: string;
  categories: Category[];
  period: 'month' | 'quarter' | 'year';
  columns: { label: string; value: number | null }[];
  allBudgets: Budget[];
  selectedYear: number;
  onOpenCell: (category: Category, period: 'month' | 'quarter' | 'year', periodValue: number | null) => void;
  onOpenForward: (category: Category, fromValue?: number | null, amount?: string, group?: ExpenseGroupOption | 'inherit') => void;
}

function TimelineSection({ title, accentClass, categories, period, columns, allBudgets, selectedYear, onOpenCell, onOpenForward }: TimelineSectionProps) {
  const GROUP_DOT_CLASSES: Record<string, string> = {
    fixed: 'bg-indigo-400',
    variable: 'bg-emerald-400',
    ignored: 'bg-gray-300',
    none: 'bg-amber-400',
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accentClass}`}>{title}</span>
        <span className="text-xs text-gray-400">{categories.length} {categories.length === 1 ? 'category' : 'categories'} · click any cell to edit</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[160px]">Category</th>
              {columns.map((col) => (
                <th key={col.label} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]">{col.label}</th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[90px]">Forward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) => {
              return (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap" style={{ boxShadow: '1px 0 0 #e5e7eb' }}>
                    <div className="flex items-center gap-1.5">
                      {cat.expense_group && (
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${GROUP_DOT_CLASSES[cat.expense_group] || 'bg-gray-300'}`} title={cat.expense_group} />
                      )}
                      {cat.name}
                      {!cat.is_shared && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-600">Personal</span>}
                    </div>
                  </td>
                  {columns.map((col) => {
                    const cell = getEffectiveCellData(cat, allBudgets, selectedYear, period, col.value);
                    const effectiveGroup = cell.hasOverride && cell.expenseGroup ? cell.expenseGroup : (cat.expense_group ?? null);
                    const dotClass = effectiveGroup ? GROUP_DOT_CLASSES[effectiveGroup] : 'bg-gray-200';
                    return (
                      <td key={col.label} className="px-1 py-1 text-center">
                        <button
                          onClick={() => onOpenCell(cat, period, col.value)}
                          className={`w-full min-w-[70px] px-2 py-1.5 rounded-lg text-xs transition-colors group ${
                            cell.hasOverride
                              ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-medium'
                              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500'
                          }`}
                          title={cell.hasOverride ? 'Override set — click to edit' : 'Using category default — click to override'}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {cell.hasOverride && cell.expenseGroup && (
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                            )}
                            {cell.amount != null ? `$${cell.amount.toFixed(0)}` : '—'}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right">
                    <button
                      onClick={() => onOpenForward(cat)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium whitespace-nowrap"
                      title="Set this budget from now on"
                    >
                      Set →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5 mr-4">
          <span className="w-3 h-3 rounded border border-blue-200 bg-blue-50 inline-block" /> Override
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-gray-200 bg-gray-50 inline-block" /> Category default
        </span>
      </div>
    </section>
  );
}
