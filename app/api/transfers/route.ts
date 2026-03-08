import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isIncomeAutoAdjustEnabledForUser,
  syncIncomeSnapshotsForAccount,
} from '@/lib/accounts/incomeSnapshotAutomation';
import { applyBalanceDelta } from '@/lib/accounts/paymentBalanceAutomation';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      from_account_name,
      from_account_id,
      to_account_name,
      to_account_id,
      date,
      notes,
      year,
      month,
      quarter,
      // Stock transfer fields
      transfer_type, // 'money' | 'stock'
      stock_symbol,
      stock_shares,
      skip_balance_update,
    } = body;

    const isStockTransfer = transfer_type === 'stock';
    const shouldSkipBalance = skip_balance_update === true;

    if (!isStockTransfer) {
      // Money transfer validation
      const parsedAmount = parseFloat(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
      }
    } else {
      // Stock transfer validation
      if (!stock_symbol || typeof stock_symbol !== 'string' || !stock_symbol.trim()) {
        return NextResponse.json({ error: 'Stock symbol is required for stock transfers' }, { status: 400 });
      }
      const parsedShares = Number(stock_shares);
      if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
        return NextResponse.json({ error: 'Stock shares must be greater than 0' }, { status: 400 });
      }
    }

    if (!to_account_id) {
      return NextResponse.json({ error: 'Destination account is required' }, { status: 400 });
    }

    if (from_account_id && from_account_id === to_account_id) {
      return NextResponse.json(
        { error: 'From and to accounts must be different' },
        { status: 400 }
      );
    }

    const { data: toAccount, error: accountError } = await supabase
      .from('accounts')
      .select('id, user_id, is_shared, investment_portfolio_enabled')
      .eq('id', to_account_id)
      .single();

    if (accountError || !toAccount) {
      return NextResponse.json({ error: 'Destination account not found or not accessible' }, { status: 400 });
    }

    let fromAccount: any = null;
    if (from_account_id) {
      const { data, error: fromErr } = await supabase
        .from('accounts')
        .select('id, user_id, is_shared, investment_portfolio_enabled')
        .eq('id', from_account_id)
        .single();
      if (fromErr || !data) {
        return NextResponse.json({ error: 'Source account not found or not accessible' }, { status: 400 });
      }
      fromAccount = data;
    }

    const receivedDate = date || new Date().toISOString().split('T')[0];

    if (isStockTransfer) {
      // ===== STOCK TRANSFER =====
      const normalizedSymbol = stock_symbol.trim().toUpperCase();
      const parsedShares = Number(stock_shares);
      const parsedAmount = Number(amount) || 0; // dollar value of transfer (optional for stock)

      // Validate source account has portfolio enabled and has enough shares
      if (from_account_id) {
        if (!fromAccount?.investment_portfolio_enabled) {
          return NextResponse.json(
            { error: 'Source account does not have investment portfolio tracking enabled' },
            { status: 400 }
          );
        }

        const { data: sourceHolding } = await supabase
          .from('account_portfolio_holdings')
          .select('id, shares')
          .eq('account_id', from_account_id)
          .eq('user_id', user.id)
          .eq('symbol', normalizedSymbol)
          .maybeSingle();

        if (!sourceHolding || Number(sourceHolding.shares) < parsedShares) {
          return NextResponse.json(
            { error: `Insufficient shares of ${normalizedSymbol} in source account (have: ${sourceHolding?.shares || 0}, need: ${parsedShares})` },
            { status: 400 }
          );
        }

        // Deduct shares from source
        const newSourceShares = Number(sourceHolding.shares) - parsedShares;
        if (newSourceShares <= 0) {
          await supabase
            .from('account_portfolio_holdings')
            .delete()
            .eq('id', sourceHolding.id)
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('account_portfolio_holdings')
            .update({ shares: newSourceShares })
            .eq('id', sourceHolding.id)
            .eq('user_id', user.id);
        }
      }

      // Validate destination has portfolio enabled
      if (!toAccount.investment_portfolio_enabled) {
        return NextResponse.json(
          { error: 'Destination account does not have investment portfolio tracking enabled' },
          { status: 400 }
        );
      }

      // Add shares to destination
      const { data: destHolding } = await supabase
        .from('account_portfolio_holdings')
        .select('id, shares')
        .eq('account_id', to_account_id)
        .eq('user_id', user.id)
        .eq('symbol', normalizedSymbol)
        .maybeSingle();

      if (destHolding?.id) {
        await supabase
          .from('account_portfolio_holdings')
          .update({ shares: Number(destHolding.shares) + parsedShares })
          .eq('id', destHolding.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('account_portfolio_holdings')
          .insert({
            account_id: to_account_id,
            user_id: user.id,
            symbol: normalizedSymbol,
            shares: parsedShares,
          });
      }

      const description = `Stock Transfer: ${parsedShares} shares of ${normalizedSymbol} from ${from_account_name || 'Account'} → ${to_account_name || 'Account'}${notes ? ` (${notes})` : ''}`;

      return NextResponse.json({
        message: 'Stock transfer recorded',
        description,
        stock_symbol: normalizedSymbol,
        stock_shares: parsedShares,
      }, { status: 201 });
    }

    // ===== MONEY TRANSFER =====
    const parsedAmount = parseFloat(amount);
    const destinationLabel = toAccount.is_shared ? 'shared account' : 'personal account';
    const description = `Transfer: ${from_account_name || 'Personal'} → ${to_account_name || destinationLabel}${notes ? ` (${notes})` : ''}`;

    let calculatedQuarter = quarter;
    if (!calculatedQuarter && month) {
      calculatedQuarter = Math.ceil(parseInt(month) / 3);
    }

    // 1. Create personal expense
    const { data: expense, error: expenseError } = await supabase
      .from('transactions')
      .insert({
        date: date || null,
        amount: parsedAmount,
        description,
        category_id: null,
        payment_method: 'Other',
        paid_by: null,
        month: month ? parseInt(month) : null,
        quarter: calculatedQuarter ? parseInt(calculatedQuarter) : null,
        year: parseInt(year) || new Date().getFullYear(),
        is_shared: false,
        user_id: user.id,
        skip_balance_update: shouldSkipBalance,
      })
      .select()
      .single();

    if (expenseError) {
      throw expenseError;
    }

    // 2. Create income entry on the destination account
    const incomeSource = `Transfer from ${from_account_name || 'personal account'}`;
    const incomeNotes = notes ? notes.trim() : null;

    const { data: incomeEntry, error: incomeError } = await supabase
      .from('income_entries')
      .insert({
        user_id: user.id,
        account_id: to_account_id,
        entry_type: 'income',
        amount: parsedAmount,
        received_date: receivedDate,
        source: incomeSource,
        notes: incomeNotes,
        tags: ['transfer'],
        skip_balance_update: shouldSkipBalance,
      })
      .select()
      .single();

    if (incomeError) {
      throw incomeError;
    }

    // 3. If from_account is specified and balance tracking is not skipped, deduct from source
    if (!shouldSkipBalance && from_account_id && fromAccount) {
      await applyBalanceDelta(
        supabase,
        from_account_id,
        user.id,
        -parsedAmount,
        `Transfer out to ${to_account_name || 'account'}`,
        {
          snapshotSource: 'transfer',
          referenceType: 'transfer_out',
          referenceId: expense.id,
          snapshotDate: receivedDate,
        }
      );
    }

    // 4. Auto-adjust balance snapshots on destination if enabled
    const shouldAutoAdjust =
      toAccount.user_id === user.id &&
      (await isIncomeAutoAdjustEnabledForUser(supabase, user.id));
    if (shouldAutoAdjust) {
      await syncIncomeSnapshotsForAccount(supabase, to_account_id, user.id);
    }

    return NextResponse.json({
      expense,
      income_entry: incomeEntry,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
