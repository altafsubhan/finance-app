# Recovery Instructions: Restore Deleted Profile

## Impact of Deleting a Profile Row

If you deleted your wife's profile row from the `profiles` table:
- ✅ **Good news**: If the user still exists in `auth.users`, we can easily restore it
- ⚠️ **Issue**: Without a profile row, sharing and profile lookups will fail (the `shared_access` table references profiles)
- ⚠️ **Issue**: Inserts into categories/budgets/transactions may fail due to foreign key checks

## Recovery Steps

### Option 1: Quick Recovery (If User Exists in auth.users)

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to restore the profile (it automatically finds her UUID from auth.users):
   ```sql
   INSERT INTO public.profiles (id, email, name, created_at)
   SELECT 
     id,
     email,
     COALESCE(raw_user_meta_data->>'name', email) as name,
     created_at
   FROM auth.users
   WHERE email = 'maira.shabbeer@outlook.com'
   ON CONFLICT (id) DO NOTHING;
   ```
3. Verify it worked:
   ```sql
   SELECT * FROM public.profiles WHERE email = 'maira.shabbeer@outlook.com';
   ```
   
   **Optional**: If you want to check if the user exists first, you can run:
   ```sql
   SELECT id, email, created_at 
   FROM auth.users 
   WHERE email = 'maira.shabbeer@outlook.com';
   ```
   But you don't need the UUID - the INSERT query above will automatically use it.

### Option 2: One-Line Recovery

If you just want to restore using the email (simplest approach):

```sql
INSERT INTO public.profiles (id, email, name, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email) as name,
  created_at
FROM auth.users
WHERE email = 'maira.shabbeer@outlook.com'
ON CONFLICT (id) DO NOTHING;
```

This is safe to run multiple times - if the profile already exists, it won't create a duplicate.

### Option 3: If User Was Also Deleted from auth.users

If both the profile AND the auth user were deleted, you'll need to:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter:
   - Email: `maira.shabbeer@outlook.com`
   - Password: (she'll need to reset it)
   - Auto Confirm User: ✅ (check this)
4. Click "Create user"
5. The trigger should automatically create a profile row
6. If it doesn't, run the SQL from Option 2

## Verification

After restoring, verify access:

1. Have your wife try to log in
2. Check that she can see transactions/categories
3. Run this to confirm the profile exists:
   ```sql
   SELECT * FROM public.profiles WHERE email = 'maira.shabbeer@outlook.com';
   ```

## Prevention

To prevent this in the future:
- Be careful when deleting from the `profiles` table
- Consider adding a soft delete mechanism instead of hard deletes
- The `profiles` table should generally only be managed through:
  - The auto-trigger when users sign up
  - Profile updates through the app

## Notes

- The `ON CONFLICT DO NOTHING` clause makes the INSERT safe to run even if the profile already exists
- The profile's `id` must match the `auth.users.id` (it's a foreign key)
- The `created_at` will be restored from the auth.users table if you use Option 1 or 2

