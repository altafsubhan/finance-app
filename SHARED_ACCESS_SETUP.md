# Shared Data Access Setup

This guide explains how to enable shared data access between you and your wife so you can both see and manage the same transactions and categories.

## Problem
Currently, the app uses Row Level Security (RLS) that restricts each user to only see their own data. This means transactions and categories are isolated per user.

## Solution
We've created a migration that allows both partners to access each other's data by modifying the RLS policies.

## Steps to Enable Shared Access

### 1. Apply the Migration

Run the migration in your Supabase SQL Editor:

1. Go to your Supabase dashboard (https://supabase.com/dashboard)
2. Select your project
3. Navigate to SQL Editor (in the left sidebar)
4. Click "New Query"
5. Copy the contents of `supabase/migrations/004_enable_shared_access.sql`
6. Paste into the SQL Editor
7. Click "Run" or press Cmd/Ctrl + Enter

This migration:
- Creates a function `get_shared_user_ids()` that returns all user IDs (both partners)
- Updates RLS policies to allow both partners to view and modify each other's data
- All authenticated users in your profiles table will have access to all data

### 2. Restart Your Application

After running the migration, restart your Next.js dev server:
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### 3. Verify It Works

After running the migration:
- Log in as yourself - you should see all transactions (yours and your wife's)
- Log in as your wife - she should see all transactions (yours and hers)
- Categories should also be shared
- Both users can add, edit, and delete transactions/categories

## Important Notes

1. **All Data is Shared**: With this setup, ALL users in the profiles table will have access to ALL data. This is fine for a household finance app with just two users.

2. **Initial Categories**: Your wife should see all categories once she logs in. If she sees an empty dropdown, she may need to:
   - Refresh the page
   - Or you can have her run the category initialization if needed (though categories should now be visible to both)

3. **Security**: This approach shares data between all users in your Supabase project. If you add more users in the future, they would also have access. For a household app with just two people, this is typically acceptable.

## Alternative Approach (More Secure, More Complex)

If you want more granular control in the future, you could:
- Add a `household_id` or `partner_id` field to profiles
- Create a households table
- Link users to specific households
- Update RLS policies to only share within households

For now, the simpler approach should work fine for two users sharing finances.

