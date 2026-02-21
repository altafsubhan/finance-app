'use client';

import { useEffect, useState } from 'react';

export interface AccountOption {
  id: string;
  name: string;
  is_shared: boolean;
  user_id?: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch('/api/accounts', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setAccounts(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore transient errors
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return { accounts };
}
