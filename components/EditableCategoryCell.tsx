'use client';

import { useState } from 'react';
import { Category } from '@/types/database';

interface EditableCategoryCellProps {
  transactionId: string;
  currentCategoryId: string;
  categories: Category[];
  onUpdate: (categoryId: string) => void;
}

export default function EditableCategoryCell({ 
  transactionId, 
  currentCategoryId, 
  categories, 
  onUpdate 
}: EditableCategoryCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(currentCategoryId);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (selectedCategoryId === currentCategoryId) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category_id: selectedCategoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setIsEditing(false);
      onUpdate(selectedCategoryId);
    } catch (error) {
      alert('Failed to update category');
      setSelectedCategoryId(currentCategoryId);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedCategoryId(currentCategoryId);
    setIsEditing(false);
  };

  const currentCategory = categories.find(c => c.id === currentCategoryId);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          autoFocus
          disabled={loading}
          className="px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onBlur={handleSave}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.type})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to edit"
    >
      {currentCategory?.name || 'Unknown'}
    </div>
  );
}

