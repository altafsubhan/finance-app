-- Recovery script to restore a deleted profile row
-- This assumes the user still exists in auth.users

-- Simple one-step recovery: Just run this query
-- It automatically finds the user's UUID from auth.users and creates the profile
-- Replace 'maira.shabbeer@outlook.com' with the actual email if different
INSERT INTO public.profiles (id, email, name, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email) as name,
  created_at
FROM auth.users
WHERE email = 'maira.shabbeer@outlook.com'
ON CONFLICT (id) DO NOTHING;  -- Safe to run even if profile already exists

-- Optional: Verify the user exists in auth.users first
-- SELECT id, email, created_at 
-- FROM auth.users 
-- WHERE email = 'maira.shabbeer@outlook.com';

-- Optional: Verify the profile was restored
-- SELECT * FROM public.profiles WHERE email = 'maira.shabbeer@outlook.com';

