'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/types/database';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeCategories = async () => {
    try {
      setInitializing(true);
      const response = await fetch('/api/categories/initialize', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        await loadCategories();
        alert('Categories initialized successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to initialize categories');
      }
    } catch (error) {
      alert('Failed to initialize categories');
    } finally {
      setInitializing(false);
    }
  };

  const toggleCategoryShared = async (category: Category) => {
    setUpdatingId(category.id);
    try {
      const response = await fetch(`/api/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: category.id,
          is_shared: !category.is_shared,
        }),
      });

      if (response.ok) {
        setCategories(prev =>
          prev.map(c =>
            c.id === category.id ? { ...c, is_shared: !c.is_shared } : c
          )
        );
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Failed to update category:', error);
    } finally {
      setUpdatingId(null);
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

  const sharedCategories = categories.filter(c => c.is_shared);
  const personalCategories = categories.filter(c => !c.is_shared);

  const renderCategoryGroup = (title: string, cats: Category[], typeFilter: string) => {
    const filtered = cats.filter(c => c.type === typeFilter);
    if (filtered.length === 0) return null;
    return (
      <div>
        <h3 className="text-lg font-semibold mb-3 capitalize">{title} ({typeFilter})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((cat) => (
            <div key={cat.id} className="p-4 border rounded-lg bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{cat.name}</div>
                {cat.default_budget && (
                  <div className="text-sm text-gray-500">
                    Budget: ${cat.default_budget.toFixed(2)}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleCategoryShared(cat)}
                disabled={updatingId === cat.id}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  cat.is_shared
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                } disabled:opacity-50`}
                title={`Click to move to ${cat.is_shared ? 'Personal' : 'Shared'}`}
              >
                {cat.is_shared ? 'Shared' : 'Personal'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Categories</h1>
            <p className="text-sm text-gray-500 mt-1">
              Click the badge on each category to toggle between Shared and Personal.
            </p>
          </div>
          {categories.length === 0 && (
            <button
              onClick={initializeCategories}
              disabled={initializing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {initializing ? 'Initializing...' : 'Initialize Default Categories'}
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No categories found.</p>
            <p className="text-gray-500">Click the button above to initialize default categories.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Shared Categories */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-blue-700">Shared Categories</h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {sharedCategories.length}
                </span>
              </div>
              <div className="space-y-6">
                {renderCategoryGroup('Monthly', sharedCategories, 'monthly')}
                {renderCategoryGroup('Quarterly', sharedCategories, 'quarterly')}
                {renderCategoryGroup('Yearly', sharedCategories, 'yearly')}
              </div>
              {sharedCategories.length === 0 && (
                <p className="text-gray-400 text-sm">No shared categories yet.</p>
              )}
            </div>

            {/* Personal Categories */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-2xl font-bold text-purple-700">Personal Categories</h2>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {personalCategories.length}
                </span>
              </div>
              <div className="space-y-6">
                {renderCategoryGroup('Monthly', personalCategories, 'monthly')}
                {renderCategoryGroup('Quarterly', personalCategories, 'quarterly')}
                {renderCategoryGroup('Yearly', personalCategories, 'yearly')}
              </div>
              {personalCategories.length === 0 && (
                <p className="text-gray-400 text-sm">No personal categories yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
