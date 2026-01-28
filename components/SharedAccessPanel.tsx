'use client';

import { useEffect, useState } from 'react';

type SharedAccessEntry = {
  id: string;
  owner_id: string;
  owner_email: string;
  shared_with_id: string;
  shared_with_email: string;
  created_at: string;
};

export default function SharedAccessPanel() {
  const [outgoing, setOutgoing] = useState<SharedAccessEntry[]>([]);
  const [incoming, setIncoming] = useState<SharedAccessEntry[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/shared-access', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load shared access');
      }
      setOutgoing(data.outgoing || []);
      setIncoming(data.incoming || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load shared access');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, []);

  const handleShare = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch('/api/shared-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to share access');
      }
      setEmail('');
      await loadAccess();
    } catch (err: any) {
      setError(err.message || 'Failed to share access');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this shared access?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/shared-access/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove shared access');
      }
      await loadAccess();
    } catch (err: any) {
      setError(err.message || 'Failed to remove shared access');
    }
  };

  return (
    <section className="bg-white border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Shared access</h2>
        <p className="text-sm text-gray-600 mt-1">
          Share your data with specific users. Sharing is one-way, so both users must
          add each other to see each other&apos;s data.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Add user by email"
          className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleShare}
          disabled={submitting || !email.trim()}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sharing...' : 'Share access'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Only existing accounts can be added. You can revoke access at any time.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Shared with
          </h3>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : outgoing.length === 0 ? (
            <div className="text-sm text-gray-500">No users shared yet.</div>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {entry.shared_with_email}
                    </div>
                    <div className="text-xs text-gray-500">
                      Shared on {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Shared by
          </h3>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : incoming.length === 0 ? (
            <div className="text-sm text-gray-500">No shared access granted.</div>
          ) : (
            <ul className="space-y-2">
              {incoming.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {entry.owner_email}
                    </div>
                    <div className="text-xs text-gray-500">
                      Shared on {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
