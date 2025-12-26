'use client';

import { useState, useRef, useEffect } from 'react';
import { Category } from '@/types/database';

interface EditableCategoryCellProps {
  transactionId: string;
  currentCategoryId: string | null;
  categories: Category[];
  onUpdate: (categoryId: string | null) => void;
}

export default function EditableCategoryCell({ 
  transactionId, 
  currentCategoryId, 
  categories, 
  onUpdate 
}: EditableCategoryCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(currentCategoryId || '');
  const [loading, setLoading] = useState(false);
  const editTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const handleSave = async () => {
    const newCategoryId = selectedCategoryId || null;
    if (newCategoryId === currentCategoryId) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category_id: newCategoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setIsEditing(false);
      onUpdate(newCategoryId);
    } catch (error) {
      alert('Failed to update category');
      setSelectedCategoryId(currentCategoryId || '');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategoryIdValue = e.target.value;
    const newCategoryId = newCategoryIdValue || null;
    setSelectedCategoryId(newCategoryIdValue);
    
    if (newCategoryId === currentCategoryId) {
      setIsEditing(false);
      return;
    }

    // Save immediately on change
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category_id: newCategoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setIsEditing(false);
      onUpdate(newCategoryId);
    } catch (error) {
      alert('Failed to update category');
      setSelectedCategoryId(currentCategoryId || '');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedCategoryId(currentCategoryId || '');
    setIsEditing(false);
  };

  const handleStartEdit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    // Clear any existing timer
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }

    // Store touch position if it's a touch event
    if ('touches' in e && e.touches.length > 0) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      
      // On mobile, activate edit mode immediately on touch (no delay)
      // This ensures the native select dropdown can open properly
      setIsEditing(true);
    } else {
      // For mouse clicks, use the delay to prevent accidental activation during scrolling
      editTimerRef.current = setTimeout(() => {
        setIsEditing(true);
        editTimerRef.current = null;
      }, 300);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // If user moves finger significantly, cancel the edit timer or exit edit mode
    if (touchStartPosRef.current && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      
      // If moved more than 10px, cancel edit
      if (deltaX > 10 || deltaY > 10) {
        if (editTimerRef.current) {
          clearTimeout(editTimerRef.current);
          editTimerRef.current = null;
        }
        // If already in edit mode, exit it (user is scrolling, not selecting)
        if (isEditing) {
          handleCancel();
        }
        touchStartPosRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    // Clear position on touch end
    touchStartPosRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // For mouse clicks, activate immediately (no delay needed)
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    setIsEditing(true);
  };

  const currentCategory = categories.find(c => c.id === currentCategoryId);

  // Ensure select is ready when editing mode is activated
  useEffect(() => {
    if (isEditing && selectRef.current) {
      // Small delay to ensure DOM is fully updated
      const timer = setTimeout(() => {
        if (selectRef.current) {
          // Focus the select element so it's ready for interaction
          selectRef.current.focus();
        }
      }, 10);
      
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <select
          ref={selectRef}
          value={selectedCategoryId}
          onChange={handleChange}
          autoFocus
          disabled={loading}
          className="px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
          onClick={(e) => {
            e.stopPropagation();
            // Ensure the select opens on mobile
            if (selectRef.current) {
              selectRef.current.focus();
            }
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            // Let the native select handle the touch - don't interfere
          }}
          onFocus={(e) => {
            // Ensure the select stays focused
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
          }}
        >
          <option value="">Uncategorized</option>
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
      onClick={handleClick}
      onTouchStart={handleStartEdit}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      title="Click to edit"
    >
      {currentCategory?.name || 'Uncategorized'}
    </div>
  );
}

