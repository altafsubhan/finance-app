# Quick Start Guide - Database Setup

## Step 1: Create Supabase Account & Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign up"
3. Sign up with GitHub (easiest) or email
4. Once logged in, click "New Project"
5. Fill in:
   - **Organization**: Create one if needed (free)
   - **Name**: `finance-app` (or any name you like)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine
6. Click "Create new project"
7. Wait 2-3 minutes for project to be provisioned

## Step 2: Get Your Connection Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **API Keys**: Supabase now has two types:
     - **New Publishable Keys** (tab: "Publishable and secret API keys")
     - **Legacy Keys** (tab: "Legacy anon, service_role API keys")
   
   **For this app, you can use EITHER:**
   - **Option A**: New publishable key (from "default" entry in the new keys tab)
   - **Option B**: Legacy anon public key (from the legacy keys tab - starts with `eyJ...`)
   
   Both will work! The legacy keys are still fully supported.

## Step 3: Set Up Environment Variables

1. A `.env.local` file has been created for you in the project root
2. Open `.env.local` and fill in your values:

   - **NEXT_PUBLIC_SUPABASE_URL**: Your project URL from Step 2
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Either your new publishable key OR legacy anon key (both work!)

**Example with legacy key:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890
```

**Example with new publishable key:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_obtgJGAbLsIuJSl_I6PA_Q__vxky...
```

**Note**: The `.env.local` file is already created with placeholders - just replace the values!

## Step 4: Run Database Migrations

1. In Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/migrations/001_initial_schema.sql` in your project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
7. You should see "Success. No rows returned"
8. Now open `supabase/migrations/002_create_profile_trigger.sql`
9. Copy ALL the contents
10. Paste into SQL Editor and Run again

## Step 5: Create User Accounts

1. In Supabase dashboard, click **Authentication** in the left sidebar
2. Click **Users** tab
3. Click **Add user** → **Create new user**
4. Create accounts for you and your wife:
   - **Email**: your-email@example.com
   - **Password**: (set a password)
   - **Auto Confirm User**: Check this box
   - Click **Create user**
   - Repeat for second account

## Step 6: Test the Connection

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. You should see the home page

4. Navigate to `/auth/login` and try logging in with one of the accounts you created

5. If login works, you're all set! 🎉

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env.local` file
- Make sure you copied the **anon public** key (not the service_role key)
- Restart the dev server after changing `.env.local`

### "relation does not exist" error
- Make sure you ran both migration files
- Check that migrations ran successfully (no errors in SQL Editor)

### Can't login
- Make sure you created users in Supabase Authentication
- Check that "Auto Confirm User" was checked when creating users
- Try creating a new user if needed

### Still having issues?
- Check the browser console for errors
- Check the terminal where `npm run dev` is running for errors
- Verify your `.env.local` file is in the project root (same folder as `package.json`)

