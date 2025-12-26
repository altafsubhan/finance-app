export type PaidBy = 'joint' | 'mano' | 'sobi' | null;

export type CategoryType = 'monthly' | 'quarterly' | 'yearly';

export type PaymentMethod = 
  | 'BOA Travel'
  | 'BOA CB'
  | 'Chase Sapphire'
  | 'Chase Amazon'
  | 'Mano Chase Freedom'
  | 'Sobi Chase Freedom'
  | 'Mano Discover'
  | 'Sobi Discover'
  | 'Mano Amex'
  | 'Subi Chase Debit'
  | 'BILT'
  | 'Cash'
  | 'Other';

export interface Transaction {
  id: string;
  date: string | null; // Optional - can be null
  amount: number;
  description: string;
  category_id: string | null; // Optional - can be null for uncategorized transactions
  payment_method: PaymentMethod;
  paid_by: PaidBy;
  month: number | null; // 1-12, required for monthly categories
  quarter: number | null; // 1-4, required for quarterly categories
  year: number; // Required
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  default_budget: number | null;
  user_id: string;
  created_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  year: number;
  period: 'month' | 'quarter' | 'year';
  period_value: number | null; // 1-12 for month, 1-4 for quarter, null for year
  amount: number;
  user_id: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

