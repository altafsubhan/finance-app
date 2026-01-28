-- Category auto-assignment rules + blocklist (shared across household via RLS function)

CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'starts_with', 'regex')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_category_rules_active_priority ON category_rules(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_category_rules_category_id ON category_rules(category_id);

CREATE TABLE IF NOT EXISTS category_rule_blocklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'starts_with', 'regex')),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_category_rule_blocklist_active ON category_rule_blocklist(is_active);

-- Enable RLS
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rule_blocklist ENABLE ROW LEVEL SECURITY;

-- Shared household access policies (re-uses get_shared_user_ids() from 004_enable_shared_access.sql)
DROP POLICY IF EXISTS "Partners can view shared category_rules" ON category_rules;
DROP POLICY IF EXISTS "Partners can insert category_rules" ON category_rules;
DROP POLICY IF EXISTS "Partners can update shared category_rules" ON category_rules;
DROP POLICY IF EXISTS "Partners can delete shared category_rules" ON category_rules;

CREATE POLICY "Partners can view shared category_rules" ON category_rules
  FOR SELECT USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can insert category_rules" ON category_rules
  FOR INSERT WITH CHECK (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can update shared category_rules" ON category_rules
  FOR UPDATE USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can delete shared category_rules" ON category_rules
  FOR DELETE USING (created_by = ANY(get_shared_user_ids()));

DROP POLICY IF EXISTS "Partners can view shared category_rule_blocklist" ON category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can insert category_rule_blocklist" ON category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can update shared category_rule_blocklist" ON category_rule_blocklist;
DROP POLICY IF EXISTS "Partners can delete shared category_rule_blocklist" ON category_rule_blocklist;

CREATE POLICY "Partners can view shared category_rule_blocklist" ON category_rule_blocklist
  FOR SELECT USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can insert category_rule_blocklist" ON category_rule_blocklist
  FOR INSERT WITH CHECK (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can update shared category_rule_blocklist" ON category_rule_blocklist
  FOR UPDATE USING (created_by = ANY(get_shared_user_ids()));

CREATE POLICY "Partners can delete shared category_rule_blocklist" ON category_rule_blocklist
  FOR DELETE USING (created_by = ANY(get_shared_user_ids()));

-- updated_at triggers
DROP TRIGGER IF EXISTS update_category_rules_updated_at ON category_rules;
CREATE TRIGGER update_category_rules_updated_at BEFORE UPDATE ON category_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_category_rule_blocklist_updated_at ON category_rule_blocklist;
CREATE TRIGGER update_category_rule_blocklist_updated_at BEFORE UPDATE ON category_rule_blocklist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


