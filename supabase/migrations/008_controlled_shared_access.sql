-- Controlled shared access (explicit grants)
-- Replaces global sharing with user-managed sharing.

-- Table to track explicit shares
CREATE TABLE IF NOT EXISTS public.shared_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(owner_id, shared_with_id),
  CHECK (owner_id <> shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_access_owner_id ON public.shared_access(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_shared_with_id ON public.shared_access(shared_with_id);

ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Users can create shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Users can delete shared access" ON public.shared_access;

CREATE POLICY "Users can view shared access" ON public.shared_access
  FOR SELECT USING (owner_id = auth.uid() OR shared_with_id = auth.uid());

CREATE POLICY "Users can create shared access" ON public.shared_access
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete shared access" ON public.shared_access
  FOR DELETE USING (owner_id = auth.uid() OR shared_with_id = auth.uid());

-- Replace global sharing function with explicit-share logic.
CREATE OR REPLACE FUNCTION public.get_shared_user_ids()
RETURNS UUID[] AS $$
DECLARE
  ids UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT ARRAY_AGG(DISTINCT id) INTO ids
  FROM (
    SELECT auth.uid() AS id
    UNION
    SELECT owner_id FROM public.shared_access WHERE shared_with_id = auth.uid()
  ) shared;

  RETURN COALESCE(ids, ARRAY[auth.uid()]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_shared_user_ids() TO authenticated;

-- Helper: look up a profile id by email for sharing.
CREATE OR REPLACE FUNCTION public.lookup_profile_id_by_email(target_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(target_email) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_profile_id_by_email(TEXT) TO authenticated;

-- Helper: return share entries with profile emails.
CREATE OR REPLACE FUNCTION public.get_shared_access_entries()
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  owner_email TEXT,
  shared_with_id UUID,
  shared_with_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    sa.id,
    sa.owner_id,
    owner_profile.email,
    sa.shared_with_id,
    shared_profile.email,
    sa.created_at
  FROM public.shared_access sa
  JOIN public.profiles owner_profile ON owner_profile.id = sa.owner_id
  JOIN public.profiles shared_profile ON shared_profile.id = sa.shared_with_id
  WHERE sa.owner_id = auth.uid() OR sa.shared_with_id = auth.uid()
  ORDER BY sa.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_shared_access_entries() TO authenticated;

-- Update policies to use explicit shares and prevent impersonation on inserts.
-- Categories
DROP POLICY IF EXISTS "Partners can view shared categories" ON public.categories;
DROP POLICY IF EXISTS "Partners can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Partners can update shared categories" ON public.categories;
DROP POLICY IF EXISTS "Partners can delete shared categories" ON public.categories;

CREATE POLICY "Users can view shared categories" ON public.categories
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update shared categories" ON public.categories
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can delete shared categories" ON public.categories
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- Budgets
DROP POLICY IF EXISTS "Partners can view shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Partners can insert budgets" ON public.budgets;
DROP POLICY IF EXISTS "Partners can update shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Partners can delete shared budgets" ON public.budgets;

CREATE POLICY "Users can view shared budgets" ON public.budgets
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update shared budgets" ON public.budgets
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can delete shared budgets" ON public.budgets
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- Transactions
DROP POLICY IF EXISTS "Partners can view shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Partners can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Partners can update shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Partners can delete shared transactions" ON public.transactions;

CREATE POLICY "Users can view shared transactions" ON public.transactions
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update shared transactions" ON public.transactions
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Users can delete shared transactions" ON public.transactions
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- Category rules
DROP POLICY IF EXISTS "Partners can view shared category_rules" ON public.category_rules;
DROP POLICY IF EXISTS "Partners can insert category_rules" ON public.category_rules;
DROP POLICY IF EXISTS "Partners can update shared category_rules" ON public.category_rules;
DROP POLICY IF EXISTS "Partners can delete shared category_rules" ON public.category_rules;

CREATE POLICY "Users can view shared category_rules" ON public.category_rules
  FOR SELECT USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Users can insert own category_rules" ON public.category_rules
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update shared category_rules" ON public.category_rules
  FOR UPDATE USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Users can delete shared category_rules" ON public.category_rules
  FOR DELETE USING (created_by = ANY(get_shared_user_ids()));

-- Category rule blocklist
DROP POLICY IF EXISTS "Partners can view shared category_rule_blocklist" ON public.category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can insert category_rule_blocklist" ON public.category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can update shared category_rule_blocklist" ON public.category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can delete shared category_rule_blocklist" ON public.category_rule_blocklist;

CREATE POLICY "Users can view shared category_rule_blocklist" ON public.category_rule_blocklist
  FOR SELECT USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Users can insert own category_rule_blocklist" ON public.category_rule_blocklist
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update shared category_rule_blocklist" ON public.category_rule_blocklist
  FOR UPDATE USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Users can delete shared category_rule_blocklist" ON public.category_rule_blocklist
  FOR DELETE USING (created_by = ANY(get_shared_user_ids()));
