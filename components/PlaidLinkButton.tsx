'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePlaidLink } from 'react-plaid-link';

const OAUTH_TOKEN_KEY = 'plaid_link_token';

interface PlaidLinkContextValue {
  startLink: (plaidItemId?: string) => void;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

const PlaidLinkContext = createContext<PlaidLinkContextValue | null>(null);

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

/** Single shared Plaid Link session — avoids multiple hooks fighting over OAuth return. */
function PlaidLinkSession({
  linkToken,
  receivedRedirectUri,
  onDone,
  onError,
}: {
  linkToken: string;
  receivedRedirectUri?: string;
  onDone: (linked?: boolean) => void;
  onError: (msg: string) => void;
}) {
  const openedRef = useRef(false);
  const finishedRef = useRef(false);
  const isOAuthResume = Boolean(receivedRedirectUri);

  const finish = useCallback((linked = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone(linked);
  }, [onDone]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: async (public_token, metadata) => {
      try {
        window.localStorage.removeItem(OAUTH_TOKEN_KEY);
      } catch {}
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
          finish(false);
          return;
        }
        clearOAuthParamsFromUrl();
        finish(true);
      } catch {
        onError('Failed to link account.');
        finish(false);
      }
    },
    onExit: (err, metadata) => {
      const status = metadata?.status?.toLowerCase() ?? '';

      // Outbound OAuth: user is leaving for the bank. Keep link_token in storage.
      if (!isOAuthResume && status === 'requires_oauth') {
        finish(false);
        return;
      }

      // Inbound OAuth resume failed (Amex error, user denied, etc.).
      if (isOAuthResume) {
        try {
          window.localStorage.removeItem(OAUTH_TOKEN_KEY);
        } catch {}
        clearOAuthParamsFromUrl();
        if (!err || err.error_code !== 'USER_EXIT') {
          onError(
            err?.display_message ||
              err?.error_message ||
              (status === 'requires_oauth'
                ? 'American Express did not complete the connection. Try again in a private window, or finish Application display information in the Plaid Dashboard.'
                : 'Bank login did not complete. Try again.')
          );
        }
        finish(false);
        return;
      }

      try {
        window.localStorage.removeItem(OAUTH_TOKEN_KEY);
      } catch {}
      clearOAuthParamsFromUrl();
      if (err?.error_code && err.error_code !== 'USER_EXIT') {
        onError(err.display_message || err.error_message || 'Link was closed.');
      }
      finish(false);
    },
  });

  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [ready, open]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!openedRef.current) {
        onError('Plaid did not open. Please try again.');
        finish(false);
      }
    }, 25000);
    return () => window.clearTimeout(t);
  }, [finish, onError]);

  return null;
}

export function PlaidLinkProvider({
  children,
  onLinked,
}: {
  children: ReactNode;
  onLinked?: () => void;
}) {
  const [session, setSession] = useState<{
    token: string;
    receivedRedirectUri?: string;
  } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthHandledRef = useRef(false);

  const endSession = useCallback(() => {
    setSession(null);
    setFetching(false);
  }, []);

  const beginSession = useCallback(
    (token: string, receivedRedirectUri?: string) => {
      setSession({ token, receivedRedirectUri });
    },
    []
  );

  const fetchLinkToken = useCallback(
    async (plaidItemId?: string) => {
      setFetching(true);
      setSession(null);
      setError(null);
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
        beginSession(data.link_token);
      } catch {
        setError('Could not start the bank link flow.');
      } finally {
        setFetching(false);
      }
    },
    [beginSession]
  );

  const startLink = useCallback(
    (plaidItemId?: string) => {
      clearOAuthParamsFromUrl();
      fetchLinkToken(plaidItemId);
    },
    [fetchLinkToken]
  );

  // One OAuth-resume handler for the whole page (Amex/Chase OAuth banks).
  useEffect(() => {
    if (oauthHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get('oauth_state_id');
    if (!oauthStateId) return;

    oauthHandledRef.current = true;

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(OAUTH_TOKEN_KEY);
    } catch {}

    if (stored) {
      beginSession(stored, window.location.href);
    } else {
      clearOAuthParamsFromUrl();
      setError('Bank login expired. Click Link again.');
    }
  }, [beginSession]);

  const handleDone = useCallback((linked = false) => {
    endSession();
    if (linked) onLinked?.();
  }, [endSession, onLinked]);

  const busy = fetching || session !== null;

  return (
    <PlaidLinkContext.Provider
      value={{
        startLink,
        busy,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm shadow-lg">
          {error}
        </div>
      )}
      {session && (
        <PlaidLinkSession
          key={session.token + (session.receivedRedirectUri || '')}
          linkToken={session.token}
          receivedRedirectUri={session.receivedRedirectUri}
          onDone={handleDone}
          onError={(msg) => setError(msg)}
        />
      )}
    </PlaidLinkContext.Provider>
  );
}

export function usePlaidLinkFlow() {
  const ctx = useContext(PlaidLinkContext);
  if (!ctx) throw new Error('usePlaidLinkFlow must be used inside PlaidLinkProvider');
  return ctx;
}

/** Simple button wired to the shared Plaid Link session. */
export default function PlaidLinkButton({
  plaidItemId,
  className,
  label,
}: {
  plaidItemId?: string;
  className?: string;
  label?: string;
}) {
  const { startLink, busy } = usePlaidLinkFlow();

  return (
    <button
      type="button"
      onClick={() => startLink(plaidItemId)}
      disabled={busy}
      className={
        className ||
        'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      }
    >
      {busy ? 'Opening…' : label || 'Link a bank / card'}
    </button>
  );
}
