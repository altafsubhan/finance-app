import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSharedParam = request.nextUrl.searchParams.get('is_shared');

    let query = supabase
      .from('categories')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (isSharedParam !== null) {
      query = query.eq('is_shared', isSharedParam === 'true');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
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
    const { name, type, default_budget, is_shared } = body;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        type,
        default_budget,
        is_shared: is_shared !== undefined ? is_shared : true,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_shared } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('id, user_id, is_shared')
      .eq('id', id)
      .single();

    if (fetchError || !existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (is_shared !== undefined) {
      updateData.is_shared = is_shared;

      // If a partner converts a shared category to personal,
      // make it personal to the actor instead of the original owner.
      if (is_shared === false && existingCategory.user_id !== user.id) {
        updateData.user_id = user.id;
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // When a category's scope changes, move only the actor's transactions to match
    if (is_shared !== undefined) {
      const { error: txError } = await supabase
        .from('transactions')
        .update({ is_shared })
        .eq('category_id', id)
        .eq('user_id', user.id);

      if (txError) {
        console.error('Failed to update transactions for category scope change:', txError);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
