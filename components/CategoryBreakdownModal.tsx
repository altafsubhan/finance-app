'use client';

import { Budget, Category, Transaction } from '@/types/database';
import BudgetVsSpendingPanel from './BudgetVsSpendingPanel';

interface CategoryBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  year: number;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  periodValue: number | null;
  periodLabel: string;
}

export default function CategoryBreakdownModal({
  isOpen,
  onClose,
  transactions,
  categories,
  budgets,
  year,
  periodType,
  periodValue,
  periodLabel,
}: CategoryBreakdownModalProps) {

  if (!isOpen) return null;

  const period = periodType === 'monthly' ? 'month' : periodType === 'quarterly' ? 'quarter' : 'year';

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Category Breakdown</h2>
            <p className="text-sm text-gray-500 mt-1">
              {periodLabel} {year} · {periodType} categories
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto overscroll-contain">
          <BudgetVsSpendingPanel
            transactions={transactions}
            categories={categories}
            budgets={budgets}
            period={period}
            year={year}
            periodValue={periodValue}
            periodLabel={periodLabel}
            enableGroupToggle={periodType === 'monthly'}
          />
        </div>
      </div>
    </div>
  );
}

