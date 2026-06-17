'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onLinked?: () => void;
  className?: string;
  label?: string;
}

const OAUTH_TOKEN_KEY = 'plaid_link_token';

/** Strip Plaid OAuth query params so later link attempts aren't treated as OAuth resumes. */
function clearOAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('oauth_state_id')) return;
  url.searchParams.delete('oauth_state_id');
  const clean = url.pathname + (url.search || '') + url.hash;
  window.history.replaceState({}, '', clean);
}

/**
 * Inner component remounted per link_token so usePlaidLink always initializes
 * fresh. react-plaid-link won't reliably reopen after the first success if the
 * hook instance is reused with a stale token.
 */
function PlaidLinkOpener({
  linkToken,
  receivedRedirectUri,
  onDone,
  onError,
}: {
  linkToken: string;
  receivedRedirectUri?: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const openedRef = useRef(false);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: async (public_token, metadata) => {
      try {
        window.localStorage.removeItem(OAUTH_TOKEN_KEY);
      } catch {}
      clearOAuthParamsFromUrl();
      try {
        const res = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ public_token, institution: metadata.institution }),
        });
        if (!res.ok) {
          const data = await res.json();
          onError(data.error || 'Failed to link account.');
          onDone();
          return;
        }
        onDone();
      } catch {
        onError('Failed to link account.');
        onDone();
      }
    },
    onExit: () => {
      try {
        window.localStorage.removeItem(OAUTH_TOKEN_KEY);
      } catch {}
      clearOAuthParamsFromUrl();
      onDone();
    },
  });

  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [ready, open]);

  return null;
}

export default function PlaidLinkButton({ onLinked, className, label }: PlaidLinkButtonProps) {
  const [session, setSession] = useState<{
    token: string;
    receivedRedirectUri?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthResumeHandled = useRef(false);

  const endSession = useCallback(() => {
    setSession(null);
    setLoading(false);
  }, []);

  const startLink = useCallback(
    async (opts?: { resumeUri?: string; storedToken?: string }) => {
      setLoading(true);
      setError(null);

      if (opts?.storedToken) {
        setSession({ token: opts.storedToken, receivedRedirectUri: opts.resumeUri });
        return;
      }

      try {
        const res = await fetch('/api/plaid/link-token', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Could not start the bank link flow.');
          setLoading(false);
          return;
        }
        try {
          window.localStorage.setItem(OAUTH_TOKEN_KEY, data.link_token);
        } catch {}
        setSession({ token: data.link_token });
      } catch {
        setError('Could not start the bank link flow.');
        setLoading(false);
      }
    },
    []
  );

  // Resume OAuth once when returning from the bank's login page.
  useEffect(() => {
    if (oauthResumeHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('oauth_state_id')) return;

    oauthResumeHandled.current = true;
    const resumeUri = window.location.href;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(OAUTH_TOKEN_KEY);
    } catch {}

    if (stored) {
      startLink({ storedToken: stored, resumeUri });
    } else {
      clearOAuthParamsFromUrl();
    }
  }, [startLink]);

  const handleClick = () => {
    clearOAuthParamsFromUrl();
    startLink();
  };

  const handleDone = () => {
    endSession();
    onLinked?.();
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || session !== null}
        className={
          className ||
          'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        }
      >
        {loading || session ? 'Opening…' : label || 'Link a bank / card'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {session && (
        <PlaidLinkOpener
          key={session.token}
          linkToken={session.token}
          receivedRedirectUri={session.receivedRedirectUri}
          onDone={handleDone}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}
