'use client';

import { useState, useEffect } from 'react';
import { Transaction, Category } from '@/types/database';

interface SplitTransactionModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSave: (splits: Split[]) => Promise<void>;
}

export interface Split {
  amount: string;
  category_id: string;
  description: string;
}

export default function SplitTransactionModal({
  transaction,
  categories,
  onClose,
  onSave,
}: SplitTransactionModalProps) {
  const [splits, setSplits] = useState<Split[]>([
    { amount: transaction.amount.toString(), category_id: transaction.category_id || '', description: transaction.description },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = splits.reduce((sum, split) => {
    const amount = parseFloat(split.amount) || 0;
    return sum + amount;
  }, 0);

  const remaining = transaction.amount - totalAmount;
  const isValid = Math.abs(remaining) < 0.01 && splits.every(s => s.amount && parseFloat(s.amount) > 0);

  const handleAddSplit = () => {
    setSplits([...splits, { amount: '', category_id: '', description: '' }]);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const handleUpdateSplit = (index: number, field: keyof Split, value: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    setSplits(updated);
  };

  const handleDistributeRemaining = () => {
    if (Math.abs(remaining) > 0.01) {
      // Add remaining to the last split
      const updated = [...splits];
      const lastIndex = updated.length - 1;
      const currentAmount = parseFloat(updated[lastIndex].amount) || 0;
      updated[lastIndex] = {
        ...updated[lastIndex],
        amount: (currentAmount + remaining).toFixed(2),
      };
      setSplits(updated);
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      setError('Total amount must equal the original transaction amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(splits);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to split transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Split Transaction</h2>

          {/* Original Transaction Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Original Transaction</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Description:</span>
                <span className="ml-2 font-medium">{transaction.description}</span>
              </div>
              <div>
                <span className="text-gray-600">Amount:</span>
                <span className="ml-2 font-medium">${transaction.amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Payment Method:</span>
                <span className="ml-2 font-medium">{transaction.payment_method}</span>
              </div>
              <div>
                <span className="text-gray-600">Date:</span>
                <span className="ml-2 font-medium">
                  {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Split Transactions */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Split Into:</h3>
              <button
                onClick={handleAddSplit}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Split
              </button>
            </div>

            <div className="space-y-4">
              {splits.map((split, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-medium text-sm">Split {index + 1}</span>
                    {splits.length > 1 && (
                      <button
                        onClick={() => handleRemoveSplit(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => handleUpdateSplit(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={split.category_id}
                        onChange={(e) => handleUpdateSplit(index, 'category_id', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <input
                        type="text"
                        value={split.description}
                        onChange={(e) => handleUpdateSplit(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={transaction.description}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Summary */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Total:</span>
              <span className={`font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                ${totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Original Amount:</span>
              <span className="font-medium">${transaction.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className={remaining > 0.01 ? 'text-red-600' : remaining < -0.01 ? 'text-red-600' : 'text-green-600'}>
                Remaining:
              </span>
              <span className={`font-medium ${remaining > 0.01 || remaining < -0.01 ? 'text-red-600' : 'text-green-600'}`}>
                ${remaining.toFixed(2)}
              </span>
            </div>
            {Math.abs(remaining) > 0.01 && (
              <button
                onClick={handleDistributeRemaining}
                className="mt-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                Add Remaining to Last Split
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Split Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

