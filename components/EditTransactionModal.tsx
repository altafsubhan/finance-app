'use client';

import { Transaction, Category } from '@/types/database';
import TransactionForm from './TransactionForm';

interface EditTransactionModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({
  transaction,
  categories,
  onClose,
  onSuccess,
}: EditTransactionModalProps) {
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit Transaction</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <TransactionForm
            categories={categories}
            onSuccess={handleSuccess}
            initialData={{
              id: transaction.id,
              date: transaction.date,
              amount: transaction.amount,
              description: transaction.description,
              category_id: transaction.category_id,
              payment_method: transaction.payment_method,
              paid_by: transaction.paid_by,
              month: transaction.month,
              quarter: transaction.quarter,
              year: transaction.year,
            }}
          />
        </div>
      </div>
    </div>
  );
}

