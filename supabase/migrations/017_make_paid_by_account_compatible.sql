-- Allow transactions.paid_by to store account ids (UUID text), not only legacy enum-like values.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_paid_by_check;
