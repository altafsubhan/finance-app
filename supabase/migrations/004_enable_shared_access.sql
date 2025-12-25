-- Enable shared access between partners for transactions and categories
-- This migration allows both partners to access each other's data

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- Create a function to get partner user IDs
-- This function will return an array of user IDs that should have access
-- For now, we'll use a simple approach: get all user IDs from profiles
-- You can customize this function to only include specific partners
CREATE OR REPLACE FUNCTION get_shared_user_ids()
RETURNS UUID[] AS $$
BEGIN
  -- Return all user IDs from profiles (both partners)
  -- In a more complex setup, you could add a partner_id or household_id field
  -- This allows all authenticated users to see all data (fine for a 2-person household)
  RETURN ARRAY(SELECT id FROM profiles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_shared_user_ids() TO authenticated;

-- Create shared access policies for categories
CREATE POLICY "Partners can view shared categories" ON categories
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can insert categories" ON categories
  FOR INSERT WITH CHECK (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can update shared categories" ON categories
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can delete shared categories" ON categories
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- Create shared access policies for budgets
CREATE POLICY "Partners can view shared budgets" ON budgets
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can insert budgets" ON budgets
  FOR INSERT WITH CHECK (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can update shared budgets" ON budgets
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can delete shared budgets" ON budgets
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

-- Create shared access policies for transactions
CREATE POLICY "Partners can view shared transactions" ON transactions
  FOR SELECT USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can insert transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can update shared transactions" ON transactions
  FOR UPDATE USING (user_id = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can delete shared transactions" ON transactions
  FOR DELETE USING (user_id = ANY(get_shared_user_ids()));

