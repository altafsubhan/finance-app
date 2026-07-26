import { Category, CategoryType, Transaction } from '@/types/database';

/** Quarter number (1-4) for a calendar month (1-12). */
export function quarterForMonth(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * Whether a transaction belongs in the expenses period filter.
 *
 * Month filters are inclusive of the matching quarter and yearly expenses
 * for the same year (year itself is filtered separately).
 * Quarter filters remain quarterly-only.
 */
export function transactionMatchesPeriod(
  transaction: Pick<Transaction, 'month' | 'quarter' | 'category_id'>,
  selectedPeriod: string,
  categories: Pick<Category, 'id' | 'type'>[]
): boolean {
  if (!selectedPeriod) return true;

  const category = categories.find((c) => c.id === transaction.category_id);
  const categoryType: CategoryType | undefined = category?.type;

  if (selectedPeriod.startsWith('Q')) {
    const quarterNum = parseInt(selectedPeriod.substring(1), 10);
    if (transaction.quarter !== quarterNum) return false;
    return categoryType === 'quarterly';
  }

  const monthNum = parseInt(selectedPeriod, 10);
  if (Number.isNaN(monthNum)) return false;

  const matchingQuarter = quarterForMonth(monthNum);

  if (categoryType === 'monthly') {
    return transaction.month === monthNum;
  }
  if (categoryType === 'quarterly') {
    return transaction.quarter === matchingQuarter;
  }
  if (categoryType === 'yearly') {
    return true;
  }

  // Uncategorized: keep month-aligned rows visible under a month filter
  return transaction.month === monthNum;
}

/** Category types offered in the category filter for a given period. */
export function categoryTypesForPeriod(selectedPeriod: string): CategoryType[] | null {
  if (!selectedPeriod) return null;
  if (selectedPeriod.startsWith('Q')) return ['quarterly'];
  return ['monthly', 'quarterly', 'yearly'];
}
