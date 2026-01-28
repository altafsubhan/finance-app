import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SeedRule = {
  pattern: string;
  category_name: string;
  match_type?: 'contains' | 'starts_with' | 'regex';
  priority?: number;
};

const SEED_RULES: SeedRule[] = [
  { pattern: 'VOYAGER CAFE', category_name: 'Food - Office', match_type: 'contains', priority: 10 },
  { pattern: 'TESLA SUPERCHARGER US', category_name: 'Car - Charging', match_type: 'contains', priority: 10 },
  { pattern: 'MOKA AND CO FREMON', category_name: 'Food - Cafe', match_type: 'contains', priority: 10 },
  { pattern: 'WHOLE FOOD MARKET', category_name: 'Grocery', match_type: 'contains', priority: 10 },
  { pattern: '=p CHARGEPOINT INC', category_name: 'Car - Charging', match_type: 'contains', priority: 10 },
];

const SEED_BLOCKLIST: Array<{ pattern: string; match_type?: 'contains' | 'starts_with' | 'regex'; reason?: string }> = [
  { pattern: 'TARGET', match_type: 'contains', reason: 'Multi-category merchant; requires manual categorization' },
  { pattern: 'AMAZON', match_type: 'contains', reason: 'Multi-category merchant; requires manual categorization' },
  { pattern: 'AMZN', match_type: 'contains', reason: 'Multi-category merchant; requires manual categorization' },
];

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id,name');
    if (categoriesError) throw categoriesError;

    const categoryByName = new Map(
      (categories ?? []).map(c => [c.name.toLowerCase(), c.id])
    );

    const toInsert = SEED_RULES.map(rule => {
      const categoryId = categoryByName.get(rule.category_name.toLowerCase());
      if (!categoryId) {
        throw new Error(`Category not found: ${rule.category_name}`);
      }
      return {
        pattern: rule.pattern,
        match_type: rule.match_type ?? 'contains',
        category_id: categoryId,
        priority: rule.priority ?? 100,
        is_active: true,
        created_by: user.id,
      };
    });

    // Avoid duplicates by checking existing rules by (pattern, match_type, category_id)
    const { data: existing, error: existingError } = await supabase
      .from('category_rules')
      .select('id,pattern,match_type,category_id');
    if (existingError) throw existingError;

    const existingKey = new Set(
      (existing ?? []).map(r => `${r.pattern}::${r.match_type}::${r.category_id}`)
    );

    const newOnes = toInsert.filter(
      r => !existingKey.has(`${r.pattern}::${r.match_type}::${r.category_id}`)
    );

    // Seed blocklist (idempotent)
    const { data: existingBlocks, error: existingBlocksError } = await supabase
      .from('category_rule_blocklist')
      .select('id,pattern,match_type');
    if (existingBlocksError) throw existingBlocksError;

    const existingBlockKey = new Set(
      (existingBlocks ?? []).map(b => `${b.pattern}::${b.match_type}`)
    );

    const blocksToInsert = SEED_BLOCKLIST
      .map(b => ({
        pattern: b.pattern,
        match_type: b.match_type ?? 'contains',
        reason: b.reason ?? null,
        is_active: true,
        created_by: user.id,
      }))
      .filter(b => !existingBlockKey.has(`${b.pattern}::${b.match_type}`));

    let insertedRules: any[] = [];
    let insertedBlocks: any[] = [];

    if (newOnes.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('category_rules')
        .insert(newOnes)
        .select();
      if (insertError) throw insertError;
      insertedRules = inserted ?? [];
    }

    if (blocksToInsert.length > 0) {
      const { data: insertedB, error: insertBError } = await supabase
        .from('category_rule_blocklist')
        .insert(blocksToInsert)
        .select();
      if (insertBError) throw insertBError;
      insertedBlocks = insertedB ?? [];
    }

    return NextResponse.json(
      {
        inserted_rules: insertedRules.length,
        inserted_blocklist: insertedBlocks.length,
        rules: insertedRules,
        blocklist: insertedBlocks,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


