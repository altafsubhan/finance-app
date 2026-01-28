import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('get_shared_access_entries');

    if (error) {
      throw error;
    }

    const entries = data || [];
    const outgoing = entries.filter((entry: any) => entry.owner_id === user.id);
    const incoming = entries.filter((entry: any) => entry.shared_with_id === user.id);

    return NextResponse.json({ outgoing, incoming });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (user.email && email === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot share access with yourself' }, { status: 400 });
    }

    const { data: targetId, error: lookupError } = await supabase.rpc('lookup_profile_id_by_email', {
      target_email: email,
    });

    if (lookupError) {
      throw lookupError;
    }

    if (!targetId) {
      return NextResponse.json({ error: 'No user found with that email' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('shared_access')
      .insert({ owner_id: user.id, shared_with_id: targetId })
      .select('id, owner_id, shared_with_id, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Access already shared with this user' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
