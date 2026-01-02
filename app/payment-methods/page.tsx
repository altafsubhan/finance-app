'use client';

import { useState, useEffect } from 'react';

interface PaymentMethod {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/payment-methods', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setAdding(true);
      setError(null);
      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (response.ok) {
        setNewName('');
        await loadPaymentMethods();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add payment method');
      }
    } catch (error) {
      setError('Failed to add payment method');
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (paymentMethod: PaymentMethod) => {
    setEditingId(paymentMethod.id);
    setEditName(paymentMethod.name);
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditName('');
        await loadPaymentMethods();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update payment method');
      }
    } catch (error) {
      setError('Failed to update payment method');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setError(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await loadPaymentMethods();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete payment method');
        alert(data.error || 'Failed to delete payment method');
      }
    } catch (error) {
      setError('Failed to delete payment method');
      alert('Failed to delete payment method');
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
          <h1 className="text-4xl font-bold">Payment Methods</h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Add New Payment Method */}
        <div className="mb-8 p-4 bg-white border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Payment Method</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
              placeholder="Payment method name"
              className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No payment methods found.</p>
            <p className="text-gray-500 mt-2">Add a payment method using the form above.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="p-4 hover:bg-gray-50">
                  {editingId === pm.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(pm.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(pm.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{pm.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(pm)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pm.id, pm.name)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

