import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    void request;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Share id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('shared_access')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
