# Deployment Guide for Vercel

Follow these steps to deploy your Finance App to Vercel:

## Step 1: Initialize Git Repository (if not already done)

```bash
cd "/Users/subi/Desktop/Tax and Finance/Finance_App"
git init
git add .
git commit -m "Initial commit: Finance tracking MVP"
```

## Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `finance-app` (or whatever you prefer)
3. **Don't** initialize it with README, .gitignore, or license (we already have these)
4. Copy the repository URL (e.g., `https://github.com/yourusername/finance-app.git`)

## Step 3: Push to GitHub

### Option A: Using Personal Access Token (Recommended)

1. **Create a Personal Access Token on GitHub:**
   - Go to GitHub.com → Your profile icon → **Settings**
   - Go to **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   - Click **"Generate new token (classic)"**
   - Name it (e.g., "Finance App Deployment")
   - Select scope: **`repo`** (check all repo permissions)
   - Click **"Generate token"**
   - **COPY THE TOKEN** (you won't see it again!)

2. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/yourusername/finance-app.git
   git branch -M main
   git push -u origin main
   ```
   - When prompted for username: enter your GitHub username
   - When prompted for password: **paste your Personal Access Token** (not your GitHub password)

### Option B: Using SSH (Alternative)

If you prefer SSH:
```bash
git remote set-url origin git@github.com:yourusername/finance-app.git
git push -u origin main
```
*(Requires SSH keys to be set up with GitHub)*

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login (you can use your GitHub account)
2. Click **"Add New Project"** or **"Import Project"**
3. Import your GitHub repository (`finance-app`)
4. Vercel will auto-detect it's a Next.js app

## Step 5: Configure Environment Variables

**IMPORTANT**: You need to add your Supabase credentials:

1. In Vercel project settings, go to **Settings** → **Environment Variables**
2. Add these two variables:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
     **Value**: Your Supabase project URL (from `.env.local`)
   
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     **Value**: Your Supabase anon key (from `.env.local`)

3. Make sure to add them for **Production**, **Preview**, and **Development** environments

## Step 6: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, you'll get a URL like `your-app.vercel.app`

## Step 7: Update Supabase Auth Settings (Important!)

After deployment, you need to add your Vercel domain to Supabase:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add your Vercel URL to **Site URL** (e.g., `https://your-app.vercel.app`)
5. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**` (for wildcard)

## Testing

Once deployed:
- Visit your Vercel URL
- Test login/logout
- Test adding transactions
- Test screenshot upload
- Share the URL with your wife for testing!

## Future Updates

After making changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

Vercel will automatically redeploy on every push to main branch.

## Troubleshooting

- **Build fails**: Check Vercel build logs for errors
- **Auth not working**: Make sure environment variables are set correctly in Vercel
- **Database errors**: Verify Supabase URL is added to allowed domains
- **Screenshot upload fails**: Tesseract.js should work on Vercel, but check build logs if issues occur

