import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: accountId, snapshotId } = await params;

    // Verify the snapshot belongs to the specified account and the user owns it
    const { data: snapshot, error: fetchError } = await supabase
      .from('account_snapshots')
      .select('id, account_id, user_id')
      .eq('id', snapshotId)
      .eq('account_id', accountId)
      .single();

    if (fetchError || !snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    // Only the user who created the snapshot (or account owner) can delete it
    if (snapshot.user_id !== user.id) {
      // Check if the user owns the account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('user_id')
        .eq('id', accountId)
        .single();

      if (accountError || !account || account.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to delete this snapshot' },
          { status: 403 }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from('account_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
