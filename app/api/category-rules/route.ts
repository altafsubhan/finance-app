import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rules, error: rulesError } = await supabase
      .from('category_rules')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (rulesError) throw rulesError;

    const { data: blocklist, error: blocklistError } = await supabase
      .from('category_rule_blocklist')
      .select('*')
      .order('created_at', { ascending: false });

    if (blocklistError) throw blocklistError;

    return NextResponse.json({ rules: rules ?? [], blocklist: blocklist ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kind } = body; // 'rule' | 'block'

    if (kind === 'rule') {
      const { pattern, match_type = 'contains', category_id, priority = 100, is_active = true } = body;
      if (!pattern || typeof pattern !== 'string') {
        return NextResponse.json({ error: 'pattern is required' }, { status: 400 });
      }
      if (!category_id || typeof category_id !== 'string') {
        return NextResponse.json({ error: 'category_id is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('category_rules')
        .insert({
          pattern: pattern.trim(),
          match_type,
          category_id,
          priority: parseInt(priority),
          is_active: !!is_active,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    if (kind === 'block') {
      const { pattern, match_type = 'contains', reason = null, is_active = true } = body;
      if (!pattern || typeof pattern !== 'string') {
        return NextResponse.json({ error: 'pattern is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('category_rule_blocklist')
        .insert({
          pattern: pattern.trim(),
          match_type,
          reason,
          is_active: !!is_active,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


