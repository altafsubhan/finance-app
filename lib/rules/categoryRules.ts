import { Category, CategoryRule, CategoryRuleBlocklist } from '@/types/database';

export type RuleSuggestion = {
  category_id: string;
  reason: string;
  matched_rule_id: string;
};

const normalize = (s: string) => s.toLowerCase().trim();

function matches(matchType: CategoryRule['match_type'], pattern: string, description: string): boolean {
  const p = normalize(pattern);
  const d = normalize(description);
  if (!p || !d) return false;

  if (matchType === 'contains') return d.includes(p);
  if (matchType === 'starts_with') return d.startsWith(p);
  if (matchType === 'regex') {
    try {
      const re = new RegExp(pattern, 'i');
      return re.test(description);
    } catch {
      return false;
    }
  }
  return false;
}

export function suggestCategoryIdForDescription(params: {
  description: string;
  rules: CategoryRule[];
  blocklist: CategoryRuleBlocklist[];
  categories: Category[];
}): RuleSuggestion | null {
  const { description, rules, blocklist, categories } = params;
  if (!description) return null;

  const activeBlock = blocklist
    .filter(b => b.is_active)
    .find(b => matches(b.match_type, b.pattern, description));
  if (activeBlock) return null;

  const sortedRules = rules
    .filter(r => r.is_active)
    .slice()
    .sort((a, b) => a.priority - b.priority);

  const matched = sortedRules.find(r => matches(r.match_type, r.pattern, description));
  if (!matched) return null;

  // ensure category exists (avoid stale rule)
  const exists = categories.some(c => c.id === matched.category_id);
  if (!exists) return null;

  return {
    category_id: matched.category_id,
    matched_rule_id: matched.id,
    reason: `${matched.match_type} match: ${matched.pattern}`,
  };
}


