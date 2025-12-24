'use client';

import { useState } from 'react';
import { PaidBy } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';

interface EditablePaidByCellProps {
  transactionId: string;
  currentPaidBy: PaidBy;
  onUpdate: (paidBy: PaidBy) => void;
}

export default function EditablePaidByCell({ 
  transactionId, 
  currentPaidBy, 
  onUpdate 
}: EditablePaidByCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPaidBy, setSelectedPaidBy] = useState<PaidBy>(currentPaidBy);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (selectedPaidBy === currentPaidBy) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paid_by: selectedPaidBy }),
      });

      if (!response.ok) {
        throw new Error('Failed to update paid by');
      }

      setIsEditing(false);
      onUpdate(selectedPaidBy);
    } catch (error) {
      alert('Failed to update paid by');
      setSelectedPaidBy(currentPaidBy);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedPaidBy(currentPaidBy);
    setIsEditing(false);
  };

  const getPaidByLabel = (paidBy: PaidBy) => {
    const option = PAID_BY_OPTIONS.find(opt => opt.value === paidBy);
    return option?.label || 'Not Paid';
  };

  if (isEditing) {
    return (
      <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <select
          value={selectedPaidBy || ''}
          onChange={(e) => setSelectedPaidBy(e.target.value as PaidBy || null)}
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
        {PAID_BY_OPTIONS.map((option) => (
          <option key={option.value || 'null'} value={option.value || ''}>
            {option.label}
          </option>
        ))}
      </select>
      </div>
    );
  }

  return (
    <div 
      className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded inline-block"
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
      {getPaidByLabel(currentPaidBy)}
    </div>
  );
}

