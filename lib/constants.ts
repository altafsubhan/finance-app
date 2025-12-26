import { PaymentMethod, CategoryType } from '@/types/database';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'BOA Travel',
  'BOA CB',
  'Chase Sapphire',
  'Chase Amazon',
  'Mano Chase Freedom',
  'Sobi Chase Freedom',
  'Mano Discover',
  'Sobi Discover',
  'Mano Amex',
  'Subi Chase Debit',
  'BILT',
  'Cash',
  'Other',
];

export const PAID_BY_OPTIONS: Array<{ value: 'joint' | 'mano' | 'sobi' | null; label: string; color: string }> = [
  { value: null, label: 'Not Paid', color: 'bg-gray-200' },
  { value: 'joint', label: 'Joint Account', color: 'bg-blue-200' },
  { value: 'mano', label: 'Mano', color: 'bg-green-200' },
  { value: 'sobi', label: 'Sobi', color: 'bg-orange-200' },
];

// Pre-populated categories based on your Excel sheet
export const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType; default_budget: number | null }> = [
  // Monthly categories
  { name: 'Grocery', type: 'monthly', default_budget: 300 },
  { name: 'Food - Office', type: 'monthly', default_budget: 200 },
  { name: 'Food - Eat Out', type: 'monthly', default_budget: 500 },
  { name: 'Food - Cafe', type: 'monthly', default_budget: 150 },
  { name: 'Activities', type: 'monthly', default_budget: 150 },
  { name: 'Car - Charging', type: 'monthly', default_budget: 80 },
  { name: 'Car - Gas', type: 'monthly', default_budget: 50 },
  { name: 'Car - Cleaning', type: 'monthly', default_budget: 40 },
  { name: 'Car - Insurance', type: 'monthly', default_budget: 260 },
  { name: 'Subscriptions', type: 'monthly', default_budget: 30 },
  { name: 'House Items', type: 'monthly', default_budget: 75 },
  { name: 'Miscellaneous', type: 'monthly', default_budget: 100 },
  { name: 'Rent', type: 'monthly', default_budget: 3720 },
  { name: 'Utilities + Electricity', type: 'monthly', default_budget: 250 },
  { name: 'Phone + Wifi', type: 'monthly', default_budget: 115 },
  { name: 'Subi Personal', type: 'monthly', default_budget: null },
  { name: 'Mano Personal', type: 'monthly', default_budget: null },
  { name: 'Health Expenses', type: 'monthly', default_budget: null },
  
  // Quarterly categories
  { name: 'Clothing Shopping', type: 'quarterly', default_budget: 250 },
  { name: 'House Shopping', type: 'quarterly', default_budget: null },
  { name: 'Body Shopping', type: 'quarterly', default_budget: 150 },
  { name: 'Personal Care', type: 'quarterly', default_budget: 50 },
  
  // Yearly categories
  { name: 'Car Registration', type: 'yearly', default_budget: 991 },
  { name: 'Car Maintenance', type: 'yearly', default_budget: 320 },
  { name: 'Travels', type: 'yearly', default_budget: 4000 },
  { name: 'Renter\'s Insurance', type: 'yearly', default_budget: 120 },
];

