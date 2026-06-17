'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onLinked?: () => void;
  className?: string;
  label?: string;
}

const OAUTH_TOKEN_KEY = 'plaid_link_token';

export default function PlaidLinkButton({ onLinked, className, label }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldOpenRef = useRef(false);

  // When an OAuth bank redirects back, Plaid appends ?oauth_state_id=... We
  // must re-initialize Link with the SAME token and the full return URL.
  const isOAuthReturn =
    typeof window !== 'undefined' && window.location.search.includes('oauth_state_id');

  const createToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start the bank link flow.');
        return;
      }
      // Persist so the token survives the OAuth redirect away and back.
      try { window.localStorage.setItem(OAUTH_TOKEN_KEY, data.link_token); } catch {}
      shouldOpenRef.current = true;
      setLinkToken(data.link_token);
    } catch {
      setError('Could not start the bank link flow.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Resume Link automatically after returning from an OAuth bank.
  useEffect(() => {
    if (!isOAuthReturn) return;
    try {
      const stored = window.localStorage.getItem(OAUTH_TOKEN_KEY);
      if (stored) {
        shouldOpenRef.current = true;
        setLinkToken(stored);
      }
    } catch {}
  }, [isOAuthReturn]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: isOAuthReturn ? window.location.href : undefined,
    onSuccess: async (public_token, metadata) => {
      try { window.localStorage.removeItem(OAUTH_TOKEN_KEY); } catch {}
      try {
        const res = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ public_token, institution: metadata.institution }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to link account.');
          return;
        }
        onLinked?.();
      } catch {
        setError('Failed to link account.');
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready && shouldOpenRef.current) {
      shouldOpenRef.current = false;
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={createToken}
        disabled={loading}
        className={
          className ||
          'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        }
      >
        {loading ? 'Starting…' : label || 'Link a bank / card'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
