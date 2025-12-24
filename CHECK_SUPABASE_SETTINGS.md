# Check These Supabase Settings

## 1. Allowed Redirect URLs

The 401 errors might be because `localhost` isn't allowed in Supabase settings.

**To fix:**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   - `http://localhost:3000`
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/callback` (if using OAuth)

## 2. Site URL

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000`

## 3. Check API Settings

1. Go to **Settings** → **API**
2. Verify your **Project URL** matches what's in `.env.local`
3. Verify your **anon public** key matches what's in `.env.local`

## 4. Test After Changes

After updating these settings:
1. Clear browser cookies/localStorage
2. Restart your dev server
3. Try logging in again
4. Check browser console for the debug logs we added

