export type PaidBy = string | null;

export type CategoryType = 'monthly' | 'quarterly' | 'yearly';

export type ExpenseGroup = 'fixed' | 'variable' | 'ignored';

export type ClaimStatus = 'unclaimed' | 'claimed';

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
  date: string | null;
  amount: number;
  description: string;
  category_id: string | null;
  payment_method: PaymentMethod;
  paid_by: PaidBy; // legacy values or account id
  paid_account_id?: string | null;
  month: number | null;
  quarter: number | null;
  year: number;
  is_shared: boolean;
  skip_balance_update: boolean;
  // Shared-card attribution / privacy (migration 019)
  attributed_to?: string | null; // profile id of the person this spend belongs to
  claim_status?: ClaimStatus;
  details_private?: boolean; // when true, non-owners see an "accounted for" placeholder
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  default_budget: number | null;
  is_shared: boolean;
  // Data-driven grouping + lifecycle (migration 019)
  expense_group?: ExpenseGroup | null;
  archived_at?: string | null;
  sort_order?: number;
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

export type RuleMatchType = 'contains' | 'starts_with' | 'regex';

export interface CategoryRule {
  id: string;
  pattern: string;
  match_type: RuleMatchType;
  category_id: string;
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRuleBlocklist {
  id: string;
  pattern: string;
  match_type: RuleMatchType;
  reason: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

