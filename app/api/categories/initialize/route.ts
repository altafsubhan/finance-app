import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if categories already exist (RLS handles shared access)
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('name');

    if (existingCategories && existingCategories.length > 0) {
      return NextResponse.json({ 
        message: 'Categories already initialized',
        count: existingCategories.length 
      });
    }

    // Insert default categories
    const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
      name: cat.name,
      type: cat.type,
      default_budget: cat.default_budget,
      user_id: user.id,
    }));

    const { data, error } = await supabase
      .from('categories')
      .insert(categoriesToInsert)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      message: 'Categories initialized successfully',
      count: data.length 
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

