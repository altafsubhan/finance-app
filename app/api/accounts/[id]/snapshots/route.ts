import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('account_snapshots')
      .select('*')
      .eq('account_id', id)
      .order('snapshot_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { balance, snapshot_date, notes } = body;

    if (balance === undefined || !snapshot_date) {
      return NextResponse.json(
        { error: 'Balance and snapshot_date are required' },
        { status: 400 }
      );
    }

    // Upsert: if a snapshot for this date exists, update it
    const { data, error } = await supabase
      .from('account_snapshots')
      .upsert(
        {
          account_id: id,
          user_id: user.id,
          balance: parseFloat(balance),
          snapshot_date,
          notes: notes || null,
        },
        { onConflict: 'account_id,snapshot_date' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
