import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { CountryCode, Products } from 'plaid';

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const plaidItemId = typeof body.plaid_item_id === 'string' ? body.plaid_item_id : null;

    const plaid = getPlaidClient();
    const redirectUri = process.env.PLAID_REDIRECT_URI?.trim();

    const tokenRequest: Parameters<typeof plaid.linkTokenCreate>[0] = {
      user: { client_user_id: user.id },
      client_name: 'Finance App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    };

    // Update mode: add more accounts or re-auth an institution already linked.
    if (plaidItemId) {
      const { data: item, error: itemError } = await supabase
        .from('plaid_items')
        .select('access_token')
        .eq('id', plaidItemId)
        .eq('user_id', user.id)
        .single();
      if (itemError || !item) {
        return NextResponse.json({ error: 'Linked institution not found' }, { status: 404 });
      }
      tokenRequest.access_token = item.access_token;
    }

    const resp = await plaid.linkTokenCreate(tokenRequest);

    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (error: any) {
    const detail = error?.response?.data || error?.message;
    return NextResponse.json({ error: 'Failed to create link token', detail }, { status: 500 });
  }
}
