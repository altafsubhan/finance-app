import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { CountryCode, Products } from 'plaid';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.' },
        { status: 503 }
      );
    }

    const plaid = getPlaidClient();
    // Required for OAuth banks (Chase, Capital One, etc.) in Production. Must
    // exactly match an "Allowed redirect URI" registered in the Plaid dashboard.
    const redirectUri = process.env.PLAID_REDIRECT_URI?.trim();
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Finance App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (error: any) {
    const detail = error?.response?.data || error?.message;
    return NextResponse.json({ error: 'Failed to create link token', detail }, { status: 500 });
  }
}
