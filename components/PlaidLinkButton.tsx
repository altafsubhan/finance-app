'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onLinked?: () => void;
  /** When set, opens Plaid in update mode to add/re-auth accounts at this institution. */
  plaidItemId?: string;
  className?: string;
  label?: string;
}

const OAUTH_TOKEN_KEY = 'plaid_link_token';

function clearOAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('oauth_state_id')) return;
  url.searchParams.delete('oauth_state_id');
  const clean = url.pathname + (url.search || '') + url.hash;
  window.history.replaceState({}, '', clean);
}

function formatLinkError(data: { error?: string; detail?: unknown }): string {
  if (data.error) return data.error;
  const detail = data.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'error_message' in detail) {
    return String((detail as { error_message: string }).error_message);
  }
  return 'Something went wrong. Please try again.';
}

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
  const finishedRef = useRef(false);
  const linkingRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  }, [onDone]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: async (public_token, metadata) => {
      linkingRef.current = true;
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
        const data = await res.json();
        if (!res.ok) {
          onError(formatLinkError(data));
          finish();
          return;
        }
        finish();
      } catch {
        onError('Failed to link account.');
        finish();
      } finally {
        linkingRef.current = false;
      }
    },
    onExit: (err) => {
      try {
        window.localStorage.removeItem(OAUTH_TOKEN_KEY);
      } catch {}
      clearOAuthParamsFromUrl();
      // onSuccess handles the happy path; onExit often fires when the modal closes too.
      if (linkingRef.current) return;
      if (err?.error_code && err.error_code !== 'USER_EXIT') {
        onError(err.display_message || err.error_message || 'Link was closed.');
      }
      finish();
    },
  });

  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [ready, open]);

  // If Plaid never becomes ready, unblock the button.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!openedRef.current) {
        onError('Plaid did not open. Please try again.');
        finish();
      }
    }, 20000);
    return () => window.clearTimeout(t);
  }, [finish, onError]);

  return null;
}

export default function PlaidLinkButton({
  onLinked,
  plaidItemId,
  className,
  label,
}: PlaidLinkButtonProps) {
  const [session, setSession] = useState<{
    token: string;
    receivedRedirectUri?: string;
  } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endSession = useCallback(() => {
    setSession(null);
    setFetching(false);
  }, []);

  const startLink = useCallback(
    async (opts?: { resumeUri?: string; storedToken?: string }) => {
      setError(null);

      if (opts?.storedToken) {
        setSession({ token: opts.storedToken, receivedRedirectUri: opts.resumeUri });
        return;
      }

      setFetching(true);
      setSession(null);
      try {
        const res = await fetch('/api/plaid/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(plaidItemId ? { plaid_item_id: plaidItemId } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(formatLinkError(data));
          return;
        }
        try {
          window.localStorage.setItem(OAUTH_TOKEN_KEY, data.link_token);
        } catch {}
        setSession({ token: data.link_token });
      } catch {
        setError('Could not start the bank link flow.');
      } finally {
        setFetching(false);
      }
    },
    [plaidItemId]
  );

  // Resume OAuth after redirect from the bank (each oauth_state_id handled once).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get('oauth_state_id');
    if (!oauthStateId) return;

    const resumeKey = `plaid_oauth_${oauthStateId}`;
    if (sessionStorage.getItem(resumeKey)) {
      clearOAuthParamsFromUrl();
      return;
    }
    sessionStorage.setItem(resumeKey, '1');

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(OAUTH_TOKEN_KEY);
    } catch {}

    if (stored) {
      startLink({ storedToken: stored, resumeUri: window.location.href });
    } else {
      clearOAuthParamsFromUrl();
      setError('Bank login expired. Click Link again.');
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

  const busy = fetching || session !== null;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          className ||
          'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        }
      >
        {busy ? 'Opening…' : label || 'Link a bank / card'}
      </button>
      {error && <span className="text-xs text-red-600 max-w-xs">{error}</span>}
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
