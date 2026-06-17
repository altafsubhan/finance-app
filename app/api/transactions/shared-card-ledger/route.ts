import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Shared-card reconciliation ledger.
 *
 * Returns every charge on a JOINTLY used payment method for a period, including
 * the partner's personal charges (so you can see they're already accounted for).
 * Private details on the partner's personal charges are REDACTED here - you see
 * the amount/date and "Personal - <name>", but not the category/description.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const year = sp.get('year');
    const month = sp.get('month');
    const quarter = sp.get('quarter');

    // Which payment methods are shared cards?
    const { data: pms } = await supabase
      .from('payment_methods')
      .select('name, is_shared')
      .eq('is_shared', true);
    const sharedCardNames = (pms || []).map((p) => p.name);

    if (sharedCardNames.length === 0) {
      return NextResponse.json({ items: [], members: [], sharedCardNames: [] });
    }

    // Household members for the attribution dropdown.
    const members: { id: string; label: string }[] = [];
    const { data: self } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('id', user.id)
      .single();
    if (self) members.push({ id: self.id, label: `${self.name || self.email} (you)` });

    const { data: shareEntries } = await supabase.rpc('get_shared_access_entries');
    for (const e of (shareEntries || []) as any[]) {
      const partnerId = e.owner_id === user.id ? e.shared_with_id : e.owner_id;
      const partnerEmail = e.owner_id === user.id ? e.shared_with_email : e.owner_email;
      if (partnerId && partnerId !== user.id && !members.some((m) => m.id === partnerId)) {
        members.push({ id: partnerId, label: partnerEmail });
      }
    }
    const memberLabel = (id: string | null) =>
      id ? members.find((m) => m.id === id)?.label || 'Partner' : null;

    // Charges on shared cards for the period.
    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, is_shared)')
      .in('payment_method', sharedCardNames)
      .order('date', { ascending: false, nullsFirst: false });

    if (year) query = query.eq('year', parseInt(year));
    if (month) query = query.eq('month', parseInt(month));
    if (quarter) query = query.eq('quarter', parseInt(quarter));

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []).map((t: any) => {
      const spendOwner = t.attributed_to || t.user_id;
      const ownerIsMe = spendOwner === user.id;
      const isPersonal = t.is_shared === false;
      const redacted = isPersonal && !ownerIsMe;

      let status: 'shared' | 'personal_mine' | 'personal_partner' | 'unassigned';
      if (t.is_shared) status = 'shared';
      else if (ownerIsMe) status = 'personal_mine';
      else status = 'personal_partner';
      if (isPersonal && !t.attributed_to) status = 'unassigned';

      return {
        id: t.id,
        date: t.date,
        amount: Math.abs(Number(t.amount)),
        payment_method: t.payment_method,
        is_shared: t.is_shared,
        claim_status: t.claim_status || 'unclaimed',
        attributed_to: t.attributed_to || null,
        attributed_to_label: memberLabel(spendOwner),
        owner_is_me: ownerIsMe,
        redacted,
        status,
        // Redact private specifics for the partner's personal charges.
        description: redacted ? null : t.description,
        category: redacted ? null : t.category?.name || null,
        category_id: redacted ? null : t.category_id || null,
      };
    });

    return NextResponse.json({ items, members, sharedCardNames });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
