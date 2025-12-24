import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactions } = body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Get all categories to map names to IDs
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (categoriesError) throw categoriesError;

    // Prepare transactions for insertion
    const transactionsToInsert = transactions.map((t: any) => {
      // Find category by name
      const category = categories?.find(
        (c) => c.name.toLowerCase() === t.category?.toLowerCase()
      );

      if (!category) {
        throw new Error(`Category not found: ${t.category}`);
      }

      // Calculate quarter from month if not provided
      let quarter = null;
      if (t.month) {
        quarter = Math.ceil(parseInt(t.month) / 3);
      }

      return {
        date: t.date || null,
        amount: parseFloat(t.amount),
        description: t.description || '',
        category_id: category.id,
        payment_method: t.payment_method || 'Other',
        paid_by: t.paid_by || null,
        year: parseInt(t.year) || new Date().getFullYear(),
        month: t.month ? parseInt(t.month) : null,
        quarter: quarter,
        user_id: user.id,
      };
    });

    // Insert transactions in batches (Supabase has limits)
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
      const batch = transactionsToInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('transactions')
        .insert(batch)
        .select();

      if (error) {
        throw error;
      }

      results.push(...(data || []));
    }

    return NextResponse.json({
      message: `Successfully imported ${results.length} transactions`,
      count: results.length,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

