# Shared Data Access Setup

This guide explains how to enable controlled sharing so only explicitly shared users can access each other's data.

## What Changed
- Sharing is no longer global for all users.
- Access is granted explicitly per user via the `shared_access` table.
- Sharing is one-way: both users must share to see each other's data.

## Steps to Enable Controlled Sharing

### 1. Apply the Migration

Run the migration in your Supabase SQL Editor:

1. Go to your Supabase dashboard (https://supabase.com/dashboard)
2. Select your project
3. Navigate to SQL Editor (in the left sidebar)
4. Click "New Query"
5. Copy the contents of `supabase/migrations/008_controlled_shared_access.sql`
6. Paste into the SQL Editor
7. Click "Run" or press Cmd/Ctrl + Enter

This migration:
- Creates a `shared_access` table to track explicit shares
- Updates `get_shared_user_ids()` to return only allowed user IDs
- Updates RLS policies so inserts must be owned by the current user

### 2. Restart Your Application

After running the migration, restart your Next.js dev server:
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### 3. Share Access via Settings

1. Log in to the app
2. Go to **Settings** → **Shared access**
3. Enter the other user's email and click **Share access**

### 4. Verify It Works

- User A should only see their own data until they share access
- After A shares with B, B can see A's data
- A will not see B's data unless B also shares with A

## Important Notes

1. **One-way sharing**: Each person must add the other to get mutual access.
2. **Existing accounts only**: The email must already exist in the profiles table.
3. **Applies to core data**: Categories, budgets, transactions, and rules use the new sharing rules.

