-- Migration 021: Shared-card visibility + attribution
--
-- Problem this solves: today a personal transaction (is_shared=false) is fully
-- hidden from the partner (migration 015). So on a JOINTLY used credit card you
-- cannot tell whether a charge has already been booked as your spouse's personal
-- expense, and you cannot attribute a charge to them.
--
-- Fix: make personal charges that sit on a SHARED payment method visible to the
-- household (existence + amount), and let either partner UPDATE them (to set
-- attribution). The API layer redacts the private details (description/category)
-- for the non-owner so it shows as an "accounted for" line, not the specifics.
--
-- DELETE stays owner-only for personal rows so a partner can never delete the
-- other person's private transaction. Additive/safe: no data removed.

-- Helper: is this payment-method name a shared card?
CREATE OR REPLACE FUNCTION public.is_shared_payment_method(pm_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_shared FROM public.payment_methods WHERE name = pm_name LIMIT 1),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_shared_payment_method(TEXT) TO authenticated;

-- ============================================================
-- SELECT: shared rows (household) + own personal + personal you
-- are attributed + ANY personal charge on a shared card.
-- ============================================================
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
CREATE POLICY "Users can view transactions" ON public.transactions
  FOR SELECT USING (
    user_id = ANY(get_shared_user_ids())
    AND (
      is_shared = true
      OR auth.uid() = user_id
      OR auth.uid() = attributed_to
      OR public.is_shared_payment_method(payment_method)
    )
  );

-- ============================================================
-- UPDATE: same visibility set, so either partner can attribute a
-- shared-card charge. (The API restricts WHICH fields a non-owner
-- may change to attribution-only.)
-- ============================================================
DROP POLICY IF EXISTS "Users can update transactions" ON public.transactions;
CREATE POLICY "Users can update transactions" ON public.transactions
  FOR UPDATE USING (
    user_id = ANY(get_shared_user_ids())
    AND (
      is_shared = true
      OR auth.uid() = user_id
      OR auth.uid() = attributed_to
      OR public.is_shared_payment_method(payment_method)
    )
  );

-- ============================================================
-- DELETE: shared rows by household; personal rows only by the
-- owner or the person they're attributed to.
-- ============================================================
DROP POLICY IF EXISTS "Users can delete transactions" ON public.transactions;
CREATE POLICY "Users can delete transactions" ON public.transactions
  FOR DELETE USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id OR auth.uid() = attributed_to
    END
  );
