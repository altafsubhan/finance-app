# Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be fully provisioned (takes a few minutes)

## Step 3: Run Database Migrations

1. In your Supabase project, go to the SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it
3. Copy the contents of `supabase/migrations/002_create_profile_trigger.sql` and run it

## Step 4: Get Your Supabase Credentials

1. In your Supabase project, go to Settings → API
2. Copy your:
   - Project URL
   - `anon` `public` key (anon/public key)

## Step 5: Configure Environment Variables

1. Create a `.env.local` file in the root directory
2. Add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 6: Create User Accounts

1. In Supabase, go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Create accounts for you and your wife:
   - Enter email addresses
   - Set passwords
   - Click "Create user"

## Step 7: Run the Development Server

```bash
npm run dev
```

## Step 8: Initialize Categories

1. Open [http://localhost:3000](http://localhost:3000)
2. Login with one of the accounts you created
3. Navigate to the Categories page
4. Click "Initialize Default Categories" to set up all your expense categories

## Step 9: Start Adding Transactions

1. Go to the Transactions page
2. Click "Add Transaction"
3. Fill in the form and save

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import your repository
4. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click "Deploy"

Your app will be live at `your-project.vercel.app`!

## Notes

- The database uses Row Level Security (RLS), so each user can only see their own data
- Categories are initialized per user, so each person needs to initialize them
- The app supports multiple years - transactions are filtered by year in the UI

