# Finance App

A personal finance tracking application built with Next.js, Supabase, and Tailwind CSS.

## Features

- 💰 Transaction tracking with flexible period support (monthly, quarterly, yearly)
- 📊 Dashboard with visual summaries and charts
- 🏷️ Category management
- 💵 Budget tracking
- 📥 CSV import for bulk transactions
- 📸 Screenshot import with OCR (Tesseract.js)
- 👥 Multi-user support (you and your partner)
- 🔐 Secure authentication with Supabase
- 💸 Private income tracking by month with account destination

## CSV Import Format

Required headers: **Date**, **Amount**, **Description**  
Optional headers: **Category**, **Payment Method**, **Paid By**

Headers are case-insensitive and common aliases are auto-detected (e.g., Transaction Date, Post
Date, Details, Memo, Merchant, Payee). Extra columns are ignored, and you can adjust column
mapping in the import UI.

Example:
```csv
Date,Amount,Description,Category,Payment Method,Paid By
2025-01-15,45.99,Grocery Store,Grocery,Chase Sapphire,joint
2025-01-16,12.50,Coffee Shop,Food - Cafe,BOA Travel,mano
2025-01-17,89.00,Gas Station,Car - Gas,Chase Freedom,sobi
```

## Tech Stack

- **Frontend/Backend**: Next.js 14+ (React, TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **OCR**: Tesseract.js

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Required for the auto-import (Plaid) + Review Inbox features
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key   # server-only; used by the daily sync cron
   PLAID_CLIENT_ID=your_plaid_client_id
   PLAID_SECRET=your_plaid_secret
   PLAID_ENV=sandbox                                          # sandbox | production
   CRON_SECRET=any_long_random_string                        # protects /api/cron/plaid-sync
   ```
   Notes:
   - Plaid **sandbox** works with Plaid's test credentials (fake banks) so you can build the flow before going live.
   - Run the new SQL migrations in `supabase/migrations/` (019, 020) against your database. They are additive and do not delete data.
   - The daily auto-sync is scheduled via `vercel.json` (`/api/cron/plaid-sync`).
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

This app is configured for easy deployment on Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

## License

Private project
