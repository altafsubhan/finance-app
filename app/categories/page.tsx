'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/types/database';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

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

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  const monthlyCategories = categories.filter(c => c.type === 'monthly');
  const quarterlyCategories = categories.filter(c => c.type === 'quarterly');
  const yearlyCategories = categories.filter(c => c.type === 'yearly');

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Categories</h1>
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
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Monthly Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyCategories.map((cat) => (
                  <div key={cat.id} className="p-4 border rounded-lg">
                    <div className="font-medium">{cat.name}</div>
                    {cat.default_budget && (
                      <div className="text-sm text-gray-500">
                        Default Budget: ${cat.default_budget.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Quarterly Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quarterlyCategories.map((cat) => (
                  <div key={cat.id} className="p-4 border rounded-lg">
                    <div className="font-medium">{cat.name}</div>
                    {cat.default_budget && (
                      <div className="text-sm text-gray-500">
                        Default Budget: ${cat.default_budget.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Yearly Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearlyCategories.map((cat) => (
                  <div key={cat.id} className="p-4 border rounded-lg">
                    <div className="font-medium">{cat.name}</div>
                    {cat.default_budget && (
                      <div className="text-sm text-gray-500">
                        Default Budget: ${cat.default_budget.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

