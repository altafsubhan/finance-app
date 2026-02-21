'use client';

import { useState, useRef, useEffect } from 'react';
import { PaidBy } from '@/types/database';
import { PAID_BY_OPTIONS } from '@/lib/constants';
import { useAccounts } from '@/lib/hooks/useAccounts';

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
  const { accounts } = useAccounts();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPaidBy, setSelectedPaidBy] = useState<PaidBy>(currentPaidBy);
  const [loading, setLoading] = useState(false);
  const editTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    setSelectedPaidBy(currentPaidBy);
  }, [currentPaidBy]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newPaidBy = value === '' ? null : value;
    setSelectedPaidBy(newPaidBy);

    if (newPaidBy === currentPaidBy) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paid_by: newPaidBy }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update paid by');
      }

      setIsEditing(false);
      onUpdate(newPaidBy);
    } catch (error: any) {
      alert(error.message || 'Failed to update paid by');
      setSelectedPaidBy(currentPaidBy);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (editTimerRef.current) clearTimeout(editTimerRef.current);

    if ('touches' in e && e.touches.length > 0) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsEditing(true);
    } else {
      editTimerRef.current = setTimeout(() => setIsEditing(true), 120);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !editTimerRef.current || e.touches.length === 0) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
    };
  }, []);

  const selectedAccount = accounts.find((a) => a.id === currentPaidBy);
  const legacy = PAID_BY_OPTIONS.find((o) => o.value === currentPaidBy);

  if (!isEditing) {
    return (
      <div
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onClick={handleStartEdit}
        onTouchStart={handleStartEdit}
        onTouchMove={handleTouchMove}
      >
        {selectedAccount?.name || legacy?.label || 'Not Paid'}
      </div>
    );
  }

  return (
    <select
      ref={selectRef}
      value={selectedPaidBy || ''}
      onChange={handleChange}
      onBlur={() => setIsEditing(false)}
      disabled={loading}
      autoFocus
      className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">Not Paid</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
      {PAID_BY_OPTIONS.filter((o) => o.value).map((option) => (
        <option key={`legacy-${option.value}`} value={option.value || ''}>
          {option.label} (legacy)
        </option>
      ))}
    </select>
  );
}
