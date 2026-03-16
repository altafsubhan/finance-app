'use client';

interface ScopeToggleProps {
  scope: 'shared' | 'personal';
  onChange: (scope: 'shared' | 'personal') => void;
}

export default function ScopeToggle({ scope, onChange }: ScopeToggleProps) {
  const isShared = scope === 'shared';
  return (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
      <button
        onClick={() => onChange('shared')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          isShared ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        Shared
      </button>
      <button
        onClick={() => onChange('personal')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          !isShared ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        Personal
      </button>
    </div>
  );
}
