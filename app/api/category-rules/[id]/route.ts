import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kind } = body; // 'rule' | 'block'

    if (kind === 'rule') {
      const update: any = {};
      if (body.pattern !== undefined) update.pattern = (body.pattern ?? '').toString();
      if (body.match_type !== undefined) update.match_type = body.match_type;
      if (body.category_id !== undefined) update.category_id = body.category_id;
      if (body.priority !== undefined) update.priority = parseInt(body.priority);
      if (body.is_active !== undefined) update.is_active = !!body.is_active;

      const { data, error } = await supabase
        .from('category_rules')
        .update(update)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (kind === 'block') {
      const update: any = {};
      if (body.pattern !== undefined) update.pattern = (body.pattern ?? '').toString();
      if (body.match_type !== undefined) update.match_type = body.match_type;
      if (body.reason !== undefined) update.reason = body.reason;
      if (body.is_active !== undefined) update.is_active = !!body.is_active;

      const { data, error } = await supabase
        .from('category_rule_blocklist')
        .update(update)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const kind = searchParams.get('kind'); // 'rule' | 'block'

    if (kind === 'rule') {
      const { error } = await supabase.from('category_rules').delete().eq('id', params.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (kind === 'block') {
      const { error } = await supabase.from('category_rule_blocklist').delete().eq('id', params.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


