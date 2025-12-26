import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get the original transaction
    const { data: originalTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !originalTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Get splits from request body
    const { splits } = await request.json();

    if (!splits || !Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json({ error: 'Invalid splits data' }, { status: 400 });
    }

    // Validate that amounts sum to original amount
    const totalAmount = splits.reduce((sum: number, split: any) => {
      return sum + (parseFloat(split.amount) || 0);
    }, 0);

    if (Math.abs(totalAmount - originalTransaction.amount) > 0.01) {
      return NextResponse.json(
        { error: 'Split amounts must equal the original transaction amount' },
        { status: 400 }
      );
    }

    // Prepare new transactions from splits
    const newTransactions = splits.map((split: any) => ({
      date: originalTransaction.date,
      amount: parseFloat(split.amount),
      description: split.description || originalTransaction.description,
      category_id: split.category_id || null,
      payment_method: originalTransaction.payment_method,
      paid_by: originalTransaction.paid_by,
      month: originalTransaction.month,
      quarter: originalTransaction.quarter,
      year: originalTransaction.year,
      user_id: originalTransaction.user_id,
    }));

    // Use a transaction to ensure atomicity
    // Delete original transaction
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      throw deleteError;
    }

    // Insert new split transactions
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('transactions')
      .insert(newTransactions)
      .select();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ 
      success: true, 
      transactions: insertedTransactions 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

