-- Add personal/shared distinction to transactions and categories.
-- Existing transactions default to shared (true) since they were shared by default.
-- Existing categories default to shared (true) for backward compatibility.

-- ============================================================
-- 1. Add is_shared column to transactions
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_transactions_is_shared
  ON public.transactions(is_shared);

-- ============================================================
-- 2. Add is_shared column to categories
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_categories_is_shared
  ON public.categories(is_shared);

-- ============================================================
-- 3. Update RLS policies for transactions
--    Personal transactions (is_shared=false) should only be
--    visible to the owner. Shared transactions (is_shared=true)
--    remain visible to partners via get_shared_user_ids().
-- ============================================================
DROP POLICY IF EXISTS "Users can view shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

CREATE POLICY "Users can view transactions" ON public.transactions
  FOR SELECT USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update transactions" ON public.transactions
  FOR UPDATE USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );

CREATE POLICY "Users can delete transactions" ON public.transactions
  FOR DELETE USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );

-- ============================================================
-- 4. Update RLS policies for categories
--    Personal categories (is_shared=false) should only be
--    visible to the owner. Shared categories remain shared.
-- ============================================================
DROP POLICY IF EXISTS "Users can view shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;

CREATE POLICY "Users can view categories" ON public.categories
  FOR SELECT USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update categories" ON public.categories
  FOR UPDATE USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );

CREATE POLICY "Users can delete categories" ON public.categories
  FOR DELETE USING (
    CASE
      WHEN is_shared = true THEN user_id = ANY(get_shared_user_ids())
      ELSE auth.uid() = user_id
    END
  );
