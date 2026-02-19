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
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      type,
      institution,
      notes,
      is_shared,
      investment_portfolio_enabled,
      investment_live_pricing_enabled,
    } = body;

    const updateFields: Record<string, any> = {};
    if (name !== undefined) updateFields.name = name;
    if (type !== undefined) updateFields.type = type;
    if (institution !== undefined) updateFields.institution = institution || null;
    if (notes !== undefined) updateFields.notes = notes || null;
    if (is_shared !== undefined) updateFields.is_shared = is_shared;
    if (investment_portfolio_enabled !== undefined) {
      if (typeof investment_portfolio_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'investment_portfolio_enabled must be a boolean' },
          { status: 400 }
        );
      }
      updateFields.investment_portfolio_enabled = investment_portfolio_enabled;
      if (!investment_portfolio_enabled) {
        updateFields.investment_live_pricing_enabled = false;
      }
    }
    if (investment_live_pricing_enabled !== undefined) {
      if (typeof investment_live_pricing_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'investment_live_pricing_enabled must be a boolean' },
          { status: 400 }
        );
      }

      if (investment_live_pricing_enabled) {
        const { data: existingAccount, error: existingAccountError } = await supabase
          .from('accounts')
          .select('investment_portfolio_enabled')
          .eq('id', id)
          .single();
        if (existingAccountError) throw existingAccountError;

        const portfolioEnabledAfterUpdate =
          updateFields.investment_portfolio_enabled ??
          existingAccount?.investment_portfolio_enabled ??
          false;
        if (!portfolioEnabledAfterUpdate) {
          return NextResponse.json(
            { error: 'Enable portfolio tracking before enabling live pricing' },
            { status: 400 }
          );
        }
      }

      updateFields.investment_live_pricing_enabled = investment_live_pricing_enabled;
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
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

    const { id } = await params;

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
