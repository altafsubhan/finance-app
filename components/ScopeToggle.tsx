'use client';

interface ScopeToggleProps {
  scope: 'shared' | 'personal' | 'all';
  onChange: (scope: 'shared' | 'personal' | 'all') => void;
  showAll?: boolean;
}

export default function ScopeToggle({ scope, onChange, showAll = false }: ScopeToggleProps) {
  return (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
      <button
        onClick={() => onChange('shared')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          scope === 'shared' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        Shared
      </button>
      <button
        onClick={() => onChange('personal')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
          scope === 'personal' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        Personal
      </button>
      {showAll && (
        <button
          onClick={() => onChange('all')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
            scope === 'all' ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          All
        </button>
      )}
    </div>
  );
}
