'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  institution: string | null;
  is_shared: boolean;
  investment_portfolio_enabled: boolean;
  investment_live_pricing_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Snapshot {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  notes: string | null;
  created_at: string;
}

interface Allocation {
  id: string;
  account_id: string;
  label: string;
  amount: number;
  allocation_type: 'fixed' | 'percentage';
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface IncomeEntry {
  id: string;
  account_id: string;
  amount: number;
  received_date: string;
}

interface IncomeAdjustment {
  amount: number;
  entryCount: number;
  snapshotDate: string;
}

interface PortfolioHolding {
  id: string;
  account_id: string;
  user_id: string;
  symbol: string;
  shares: number;
  created_at: string;
  updated_at: string;
}

interface MarketQuote {
  price: number | null;
  change_percent: number | null;
  currency: string | null;
  as_of: string | null;
}

interface LivePortfolioSummary {
  value: number | null;
  hasHoldings: boolean;
  missingSymbols: string[];
}

const CASH_HOLDING_SYMBOL = 'CASH';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'loan', label: 'Loan' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const ALLOCATION_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    checking: '🏦',
    savings: '💰',
    credit_card: '💳',
    investment: '📈',
    retirement: '🏖️',
    loan: '🏠',
    crypto: '₿',
    cash: '💵',
    other: '📁',
  };
  return icons[type] || '📁';
}

function getTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find(t => t.value === type)?.label || type;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshotsByAccount, setSnapshotsByAccount] = useState<Record<string, Snapshot[]>>({});
  const [allocationsByAccount, setAllocationsByAccount] = useState<Record<string, Allocation[]>>({});
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [portfolioByAccount, setPortfolioByAccount] = useState<Record<string, PortfolioHolding[]>>(
    {}
  );
  const [newHoldingByAccount, setNewHoldingByAccount] = useState<
    Record<string, { symbol: string; shares: string }>
  >({});
  const [savingHoldingsByAccount, setSavingHoldingsByAccount] = useState<
    Record<string, boolean>
  >({});
  const [updatingInvestmentSettingsByAccount, setUpdatingInvestmentSettingsByAccount] = useState<
    Record<string, boolean>
  >({});
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [editHolding, setEditHolding] = useState({ symbol: '', shares: '' });
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, MarketQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [quotesLastUpdated, setQuotesLastUpdated] = useState<string | null>(null);
  const [autoAdjustBalancesFromIncome, setAutoAdjustBalancesFromIncome] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  // Add account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'checking', institution: '', notes: '' });
  const [addingAccount, setAddingAccount] = useState(false);

  // Edit account
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState({ name: '', type: '', institution: '', notes: '', is_shared: false });

  // Add snapshot form
  const [snapshotAccountId, setSnapshotAccountId] = useState<string | null>(null);
  const [newSnapshot, setNewSnapshot] = useState({ balance: '', snapshot_date: new Date().toISOString().split('T')[0], notes: '' });
  const [addingSnapshot, setAddingSnapshot] = useState(false);

  // Add allocation form
  const [allocationAccountId, setAllocationAccountId] = useState<string | null>(null);
  const [newAllocation, setNewAllocation] = useState({ label: '', amount: '', color: ALLOCATION_COLORS[0], allocation_type: 'fixed' as 'fixed' | 'percentage' });
  const [addingAllocation, setAddingAllocation] = useState(false);

  // Edit allocation
  const [editingAllocId, setEditingAllocId] = useState<string | null>(null);
  const [editAlloc, setEditAlloc] = useState({ label: '', amount: '', color: '', allocation_type: 'fixed' as 'fixed' | 'percentage' });

  // Delete confirmation
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const hasMountedRef = useRef(false);

  // ─── Data Loading ────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        return data as Account[];
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
    return [];
  }, []);

  const loadSnapshots = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/snapshots`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSnapshotsByAccount(prev => ({ ...prev, [accountId]: data }));
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
  }, []);

  const loadAllocations = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/allocations`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllocationsByAccount(prev => ({ ...prev, [accountId]: data }));
      }
    } catch (err) {
      console.error('Failed to load allocations:', err);
    }
  }, []);

  const loadPortfolio = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/portfolio`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPortfolioByAccount(prev => ({ ...prev, [accountId]: data }));
      }
    } catch (err) {
      console.error('Failed to load portfolio holdings:', err);
    }
  }, []);

  const loadIncomeEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/income', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIncomeEntries(data);
      }
    } catch (err) {
      console.error('Failed to load income entries:', err);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAutoAdjustBalancesFromIncome(Boolean(data.auto_adjust_balances_from_income));
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      const accts = await loadAccounts();
      // Load snapshots + allocations + related preferences in parallel
      await Promise.all([
        Promise.all(
          accts.map((a: Account) =>
            Promise.all([
              loadSnapshots(a.id),
              loadAllocations(a.id),
              a.type === 'investment' ? loadPortfolio(a.id) : Promise.resolve(),
            ])
          )
        ),
        loadIncomeEntries(),
        loadPreferences(),
      ]);
      setInitialLoading(false);
      hasMountedRef.current = true;
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Account CRUD ────────────────────────────────────────────────────────
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name.trim()) return;
    setAddingAccount(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newAccount),
      });
      if (res.ok) {
        const created = await res.json();
        setAccounts(prev => [...prev, created]);
        setSnapshotsByAccount(prev => ({ ...prev, [created.id]: [] }));
        setAllocationsByAccount(prev => ({ ...prev, [created.id]: [] }));
        setPortfolioByAccount(prev => ({ ...prev, [created.id]: [] }));
        setNewAccount({ name: '', type: 'checking', institution: '', notes: '' });
        setShowAddAccount(false);
        setExpandedAccountId(created.id);
      }
    } catch (err) {
      console.error('Failed to add account:', err);
    } finally {
      setAddingAccount(false);
    }
  };

  const handleUpdateAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editAccount),
      });
      if (res.ok) {
        const updated = await res.json();
        setAccounts(prev => prev.map(a => a.id === accountId ? updated : a));
        if (updated.type === 'investment') {
          await loadPortfolio(accountId);
        } else {
          setPortfolioByAccount(prev => {
            const next = { ...prev };
            delete next[accountId];
            return next;
          });
        }
        setEditingAccountId(null);
      }
    } catch (err) {
      console.error('Failed to update account:', err);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        setSnapshotsByAccount(prev => {
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
        setAllocationsByAccount(prev => {
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
        setPortfolioByAccount(prev => {
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
        if (expandedAccountId === accountId) setExpandedAccountId(null);
        setDeletingAccountId(null);
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  // ─── Snapshot CRUD ───────────────────────────────────────────────────────
  const handleAddSnapshot = async (accountId: string) => {
    if (!newSnapshot.balance || !newSnapshot.snapshot_date) return;
    setAddingSnapshot(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSnapshot),
      });
      if (res.ok) {
        await loadSnapshots(accountId);
        setNewSnapshot({ balance: '', snapshot_date: new Date().toISOString().split('T')[0], notes: '' });
        setSnapshotAccountId(null);
      }
    } catch (err) {
      console.error('Failed to add snapshot:', err);
    } finally {
      setAddingSnapshot(false);
    }
  };

  // ─── Investment Portfolio + Live Pricing ──────────────────────────────────
  const setHoldingDraft = (
    accountId: string,
    updates: Partial<{ symbol: string; shares: string }>
  ) => {
    setNewHoldingByAccount(prev => ({
      ...prev,
      [accountId]: {
        symbol: prev[accountId]?.symbol || '',
        shares: prev[accountId]?.shares || '',
        ...updates,
      },
    }));
  };

  const handleAddHolding = async (accountId: string) => {
    const draft = newHoldingByAccount[accountId] || { symbol: '', shares: '' };
    if (!draft.symbol.trim()) return;
    const parsedShares = Number(draft.shares);
    if (!Number.isFinite(parsedShares) || parsedShares <= 0) return;

    setSavingHoldingsByAccount(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/accounts/${accountId}/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          symbol: draft.symbol.trim().toUpperCase(),
          shares: parsedShares,
        }),
      });
      if (res.ok) {
        await loadPortfolio(accountId);
        setHoldingDraft(accountId, { symbol: '', shares: '' });
      }
    } catch (err) {
      console.error('Failed to add portfolio holding:', err);
    } finally {
      setSavingHoldingsByAccount(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleAddCashHolding = async (accountId: string) => {
    const draft = newHoldingByAccount[accountId] || { symbol: '', shares: '' };
    const parsedCashAmount = Number(draft.shares);
    if (!Number.isFinite(parsedCashAmount) || parsedCashAmount <= 0) return;

    setSavingHoldingsByAccount(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/accounts/${accountId}/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          symbol: CASH_HOLDING_SYMBOL,
          shares: parsedCashAmount,
        }),
      });
      if (res.ok) {
        await loadPortfolio(accountId);
        setHoldingDraft(accountId, { symbol: '', shares: '' });
      }
    } catch (err) {
      console.error('Failed to add cash holding:', err);
    } finally {
      setSavingHoldingsByAccount(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleUpdateHolding = async (accountId: string, holdingId: string) => {
    const parsedShares = Number(editHolding.shares);
    if (!Number.isFinite(parsedShares) || parsedShares <= 0) return;

    try {
      const res = await fetch(`/api/accounts/${accountId}/portfolio/${holdingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          symbol: editHolding.symbol.trim().toUpperCase(),
          shares: parsedShares,
        }),
      });
      if (res.ok) {
        await loadPortfolio(accountId);
        setEditingHoldingId(null);
      }
    } catch (err) {
      console.error('Failed to update portfolio holding:', err);
    }
  };

  const handleDeleteHolding = async (accountId: string, holdingId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/portfolio/${holdingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadPortfolio(accountId);
        if (editingHoldingId === holdingId) setEditingHoldingId(null);
      }
    } catch (err) {
      console.error('Failed to delete portfolio holding:', err);
    }
  };

  const handleUpdateInvestmentSettings = async (
    accountId: string,
    updates: Partial<
      Pick<Account, 'investment_portfolio_enabled' | 'investment_live_pricing_enabled'>
    >
  ) => {
    setUpdatingInvestmentSettingsByAccount(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setAccounts(prev => prev.map(a => (a.id === accountId ? updated : a)));
        if (updated.type === 'investment' && updated.investment_portfolio_enabled) {
          await loadPortfolio(accountId);
        }
      }
    } catch (err) {
      console.error('Failed to update investment settings:', err);
    } finally {
      setUpdatingInvestmentSettingsByAccount(prev => ({ ...prev, [accountId]: false }));
    }
  };

  // ─── Allocation CRUD ─────────────────────────────────────────────────────
  const handleAddAllocation = async (accountId: string) => {
    if (!newAllocation.label.trim()) return;
    setAddingAllocation(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newAllocation),
      });
      if (res.ok) {
        await loadAllocations(accountId);
        setNewAllocation({ label: '', amount: '', color: ALLOCATION_COLORS[0], allocation_type: 'fixed' });
        setAllocationAccountId(null);
      }
    } catch (err) {
      console.error('Failed to add allocation:', err);
    } finally {
      setAddingAllocation(false);
    }
  };

  const handleUpdateAllocation = async (accountId: string, allocId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/allocations/${allocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editAlloc),
      });
      if (res.ok) {
        await loadAllocations(accountId);
        setEditingAllocId(null);
      }
    } catch (err) {
      console.error('Failed to update allocation:', err);
    }
  };

  const handleDeleteAllocation = async (accountId: string, allocId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/allocations/${allocId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadAllocations(accountId);
      }
    } catch (err) {
      console.error('Failed to delete allocation:', err);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const accountById = useMemo(() => {
    return accounts.reduce<Record<string, Account>>((map, account) => {
      map[account.id] = account;
      return map;
    }, {});
  }, [accounts]);

  const isLivePricingModeEnabled = useCallback(
    (accountId: string): boolean => {
      const account = accountById[accountId];
      return Boolean(
        account &&
        account.type === 'investment' &&
        account.investment_portfolio_enabled &&
        account.investment_live_pricing_enabled
      );
    },
    [accountById]
  );

  const trackedPortfolioSymbols = useMemo(() => {
    const symbols = new Set<string>();
    accounts.forEach((account) => {
      if (!isLivePricingModeEnabled(account.id)) return;
      const holdings = portfolioByAccount[account.id] || [];
      holdings.forEach((holding) => {
        const symbol = String(holding.symbol || '').toUpperCase();
        if (!symbol || symbol === CASH_HOLDING_SYMBOL) return;
        symbols.add(symbol);
      });
    });
    return Array.from(symbols).sort();
  }, [accounts, portfolioByAccount, isLivePricingModeEnabled]);

  useEffect(() => {
    if (trackedPortfolioSymbols.length === 0) {
      setQuotesBySymbol({});
      setQuotesError(null);
      setQuotesLastUpdated(null);
      return;
    }

    let isCancelled = false;

    const refreshQuotes = async () => {
      try {
        setQuotesLoading(true);
        const res = await fetch(
          `/api/market/quotes?symbols=${encodeURIComponent(trackedPortfolioSymbols.join(','))}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const payload = await res.json();
          throw new Error(payload.error || 'Failed to load live market data');
        }
        const data = await res.json();
        if (!isCancelled) {
          setQuotesBySymbol(data.quotes || {});
          setQuotesLastUpdated(data.fetched_at || new Date().toISOString());
          setQuotesError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to refresh market quotes:', err);
          setQuotesError(err?.message || 'Failed to load live market data');
        }
      } finally {
        if (!isCancelled) setQuotesLoading(false);
      }
    };

    refreshQuotes();
    const intervalId = setInterval(refreshQuotes, 15 * 60 * 1000);
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [trackedPortfolioSymbols]);

  const latestSnapshotByAccount = useMemo(() => {
    const map: Record<string, Snapshot | null> = {};
    accounts.forEach((account) => {
      const snapshots = snapshotsByAccount[account.id];
      map[account.id] = snapshots && snapshots.length > 0 ? snapshots[0] : null;
    });
    return map;
  }, [accounts, snapshotsByAccount]);

  const livePortfolioByAccount = useMemo(() => {
    const map: Record<string, LivePortfolioSummary> = {};
    accounts.forEach((account) => {
      if (!isLivePricingModeEnabled(account.id)) return;
      const holdings = portfolioByAccount[account.id] || [];
      if (holdings.length === 0) {
        map[account.id] = { value: null, hasHoldings: false, missingSymbols: [] };
        return;
      }

      let totalValue = 0;
      const missingSymbols: string[] = [];
      holdings.forEach((holding) => {
        const symbol = String(holding.symbol || '').toUpperCase();
        if (symbol === CASH_HOLDING_SYMBOL) {
          totalValue += Number(holding.shares);
          return;
        }
        const quote = quotesBySymbol[symbol];
        if (!quote || quote.price === null) {
          missingSymbols.push(symbol);
          return;
        }
        totalValue += Number(holding.shares) * Number(quote.price);
      });

      map[account.id] = {
        value: missingSymbols.length === 0 ? totalValue : null,
        hasHoldings: true,
        missingSymbols: Array.from(new Set(missingSymbols)),
      };
    });

    return map;
  }, [accounts, portfolioByAccount, quotesBySymbol, isLivePricingModeEnabled]);

  const incomeAdjustmentsByAccount = useMemo(() => {
    const map: Record<string, IncomeAdjustment> = {};

    if (!autoAdjustBalancesFromIncome) {
      return map;
    }

    incomeEntries.forEach((entry) => {
      const account = accountById[entry.account_id];
      const isLiveTrackedInvestment = Boolean(
        account &&
        account.type === 'investment' &&
        account.investment_portfolio_enabled &&
        account.investment_live_pricing_enabled
      );
      if (isLiveTrackedInvestment) return;
      const snapshot = latestSnapshotByAccount[entry.account_id];
      if (!snapshot) return;
      if (entry.received_date <= snapshot.snapshot_date) return;

      if (!map[entry.account_id]) {
        map[entry.account_id] = {
          amount: 0,
          entryCount: 0,
          snapshotDate: snapshot.snapshot_date,
        };
      }

      map[entry.account_id].amount += Number(entry.amount);
      map[entry.account_id].entryCount += 1;
    });

    return map;
  }, [autoAdjustBalancesFromIncome, incomeEntries, latestSnapshotByAccount, accountById]);

  const getLatestManualBalance = (accountId: string): number | null => {
    const latestSnapshot = latestSnapshotByAccount[accountId];
    if (!latestSnapshot) return null;
    return Number(latestSnapshot.balance);
  };

  const getIncomeAdjustment = (accountId: string): IncomeAdjustment | null => {
    return incomeAdjustmentsByAccount[accountId] || null;
  };

  const getLivePortfolioSummary = (accountId: string): LivePortfolioSummary | null => {
    return livePortfolioByAccount[accountId] || null;
  };

  const getLatestBalance = (accountId: string): number | null => {
    const account = accountById[accountId];
    const liveSummary = getLivePortfolioSummary(accountId);
    const hasLivePortfolioValue = Boolean(
      account &&
      account.type === 'investment' &&
      account.investment_portfolio_enabled &&
      account.investment_live_pricing_enabled &&
      liveSummary &&
      liveSummary.value !== null
    );
    if (hasLivePortfolioValue) {
      return liveSummary?.value ?? null;
    }

    const manualBalance = getLatestManualBalance(accountId);
    if (manualBalance === null) return null;
    if (!autoAdjustBalancesFromIncome) return manualBalance;

    const adjustment = getIncomeAdjustment(accountId);
    return manualBalance + (adjustment?.amount || 0);
  };

  const resolveAllocAmount = (alloc: Allocation, balance: number | null): number => {
    if (alloc.allocation_type === 'percentage') {
      return balance !== null ? (Number(alloc.amount) / 100) * balance : 0;
    }
    return Number(alloc.amount);
  };

  const getTotalAllocated = (accountId: string): number => {
    const allocs = allocationsByAccount[accountId];
    if (!allocs) return 0;
    const balance = getLatestBalance(accountId);
    return allocs.reduce((sum, a) => sum + resolveAllocAmount(a, balance), 0);
  };

  const getBalanceChange = (accountId: string): { amount: number; percent: number } | null => {
    const snapshots = snapshotsByAccount[accountId];
    if (!snapshots || snapshots.length < 2) return null;
    const current = Number(snapshots[0].balance);
    const previous = Number(snapshots[1].balance);
    if (previous === 0) return null;
    return {
      amount: current - previous,
      percent: ((current - previous) / Math.abs(previous)) * 100,
    };
  };

  const accountsWithUnrecordedAdjustments = useMemo(
    () =>
      Object.values(incomeAdjustmentsByAccount).filter(
        (adjustment) => adjustment.amount !== 0
      ).length,
    [incomeAdjustmentsByAccount]
  );

  const incomeEntryCountByAccount = useMemo(() => {
    const counts: Record<string, number> = {};
    incomeEntries.forEach((entry) => {
      counts[entry.account_id] = (counts[entry.account_id] || 0) + 1;
    });
    return counts;
  }, [incomeEntries]);

  const getTotalNetWorth = (): number => {
    return accounts.reduce((sum, acct) => {
      const bal = getLatestBalance(acct.id);
      if (bal === null) return sum;
      // Credit cards and loans are liabilities (negative)
      if (acct.type === 'credit_card' || acct.type === 'loan') {
        return sum - Math.abs(bal);
      }
      return sum + bal;
    }, 0);
  };

  // Group accounts by type
  const accountsByType = accounts.reduce<Record<string, Account[]>>((groups, acct) => {
    if (!groups[acct.type]) groups[acct.type] = [];
    groups[acct.type].push(acct);
    return groups;
  }, {});

  // ─── Render ──────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <main className="min-h-screen p-1 sm:p-4 lg:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-1 sm:p-4 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Account Balances</h1>
            <p className="text-sm text-gray-500 mt-1">Track your balances across all accounts</p>
          </div>
          <button
            onClick={() => setShowAddAccount(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
          >
            + Add Account
          </button>
        </div>

        <div
          className={`border rounded-xl px-4 py-3 text-sm ${
            autoAdjustBalancesFromIncome
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
        >
          {autoAdjustBalancesFromIncome ? (
            <>
              Income-based auto-adjustments are enabled. Income entries after the latest manual
              balance snapshot are shown as unrecorded adjustments.
              {accountsWithUnrecordedAdjustments > 0 && (
                <span className="ml-1 font-medium">
                  {accountsWithUnrecordedAdjustments} account
                  {accountsWithUnrecordedAdjustments === 1 ? '' : 's'} currently adjusted.
                </span>
              )}
            </>
          ) : (
            <>
              Income-based auto-adjustments are disabled. You can enable them in{' '}
              <Link href="/settings" className="font-medium underline hover:text-gray-800">
                Settings
              </Link>
              .
            </>
          )}
        </div>

        {/* ─── Net Worth Summary ───────────────────────────────── */}
        {accounts.length > 0 && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Total Net Worth</p>
                <p className={`text-2xl font-bold ${getTotalNetWorth() >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {formatCurrency(getTotalNetWorth())}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assets / Liabilities</p>
                <p className="text-lg font-semibold text-gray-900">
                  <span className="text-green-600">
                    {formatCurrency(
                      accounts.reduce((s, a) => {
                        const b = getLatestBalance(a.id);
                        return s + (b !== null && a.type !== 'credit_card' && a.type !== 'loan' ? b : 0);
                      }, 0)
                    )}
                  </span>
                  {' / '}
                  <span className="text-red-600">
                    {formatCurrency(
                      accounts.reduce((s, a) => {
                        const b = getLatestBalance(a.id);
                        return s + (b !== null && (a.type === 'credit_card' || a.type === 'loan') ? Math.abs(b) : 0);
                      }, 0)
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Add Account Modal ───────────────────────────────── */}
        {showAddAccount && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Add Account</h2>
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                    <input
                      type="text"
                      value={newAccount.name}
                      onChange={e => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Chase Checking"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
                    <select
                      value={newAccount.type}
                      onChange={e => setNewAccount(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ACCOUNT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <input
                      type="text"
                      value={newAccount.institution}
                      onChange={e => setNewAccount(prev => ({ ...prev, institution: e.target.value }))}
                      placeholder="e.g. Chase, Fidelity"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input
                      type="text"
                      value={newAccount.notes}
                      onChange={e => setNewAccount(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAccount(false)}
                      className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingAccount || !newAccount.name.trim()}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingAccount ? 'Adding...' : 'Add Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ─── Delete Confirmation Modal ───────────────────────── */}
        {deletingAccountId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will permanently delete this account and all its balance history and allocations. This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingAccountId(null)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAccount(deletingAccountId)}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Accounts ───────────────────────────────────────── */}
        {accounts.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">No accounts yet</p>
            <p className="text-gray-400 text-sm mb-6">Add your first account to start tracking balances.</p>
            <button
              onClick={() => setShowAddAccount(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              + Add Account
            </button>
          </div>
        ) : (
          Object.entries(accountsByType).map(([type, typeAccounts]) => (
            <div key={type} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span>{getTypeIcon(type)}</span>
                <span>{getTypeLabel(type)}</span>
                <span className="text-gray-400 font-normal">({typeAccounts.length})</span>
              </h2>
              <div className="space-y-2">
                {typeAccounts.map(account => {
                  const latestBalance = getLatestBalance(account.id);
                  const latestManualBalance = getLatestManualBalance(account.id);
                  const incomeAdjustment = getIncomeAdjustment(account.id);
                  const livePortfolioSummary = getLivePortfolioSummary(account.id);
                  const hasLiveBalance = Boolean(
                    account.type === 'investment' &&
                    account.investment_portfolio_enabled &&
                    account.investment_live_pricing_enabled &&
                    livePortfolioSummary &&
                    livePortfolioSummary.value !== null
                  );
                  const change = getBalanceChange(account.id);
                  const allocations = allocationsByAccount[account.id] || [];
                  const holdings = portfolioByAccount[account.id] || [];
                  const hasCashHolding = holdings.some(
                    (holding) => String(holding.symbol || '').toUpperCase() === CASH_HOLDING_SYMBOL
                  );
                  const totalAllocated = getTotalAllocated(account.id);
                  const unallocated = latestBalance !== null ? latestBalance - totalAllocated : 0;
                  const isExpanded = expandedAccountId === account.id;
                  const snapshots = snapshotsByAccount[account.id] || [];
                  const isEditing = editingAccountId === account.id;
                  const relatedIncomeEntryCount = incomeEntryCountByAccount[account.id] || 0;
                  const holdingDraft = newHoldingByAccount[account.id] || { symbol: '', shares: '' };
                  const updatingInvestmentSettings =
                    updatingInvestmentSettingsByAccount[account.id] || false;
                  const savingHolding = savingHoldingsByAccount[account.id] || false;

                  return (
                    <div
                      key={account.id}
                      className="bg-white border rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* ── Account Header ── */}
                      <div
                        className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{getTypeIcon(account.type)}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 truncate">{account.name}</p>
                              {account.is_shared && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Shared</span>
                              )}
                            </div>
                            {account.institution && (
                              <p className="text-xs text-gray-400">{account.institution}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            {latestBalance !== null ? (
                              <>
                                <p className={`font-semibold text-lg ${
                                  account.type === 'credit_card' || account.type === 'loan'
                                    ? 'text-red-600'
                                    : 'text-gray-900'
                                }`}>
                                  {formatCurrency(latestBalance)}
                                </p>
                                {autoAdjustBalancesFromIncome &&
                                  latestManualBalance !== null &&
                                  incomeAdjustment &&
                                  incomeAdjustment.amount !== 0 && (
                                    <p
                                      className={`text-xs ${
                                        incomeAdjustment.amount >= 0
                                          ? 'text-blue-600'
                                          : 'text-red-600'
                                      }`}
                                    >
                                      {incomeAdjustment.amount >= 0 ? '+' : ''}
                                      {formatCurrency(incomeAdjustment.amount)} unrecorded adjustment
                                    </p>
                                  )}
                                {autoAdjustBalancesFromIncome &&
                                  latestManualBalance !== null &&
                                  incomeAdjustment &&
                                  incomeAdjustment.amount !== 0 && (
                                    <p className="text-xs text-gray-400">
                                      Manual snapshot: {formatCurrency(latestManualBalance)}
                                    </p>
                                  )}
                                {!hasLiveBalance && change && (
                                  <p className={`text-xs ${change.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.amount >= 0 ? '+' : ''}{formatCurrency(change.amount)}
                                    {' '}
                                    ({change.percent >= 0 ? '+' : ''}{change.percent.toFixed(1)}%)
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-gray-400">No balance recorded</p>
                            )}
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* ── Expanded Detail ── */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {/* Account actions */}
                          <div className="px-4 sm:px-6 py-3 bg-gray-50 flex flex-wrap gap-2 items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSnapshotAccountId(account.id);
                                setNewSnapshot({ balance: '', snapshot_date: new Date().toISOString().split('T')[0], notes: '' });
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"
                            >
                              Update Balance
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAllocationAccountId(account.id);
                                setNewAllocation({ label: '', amount: '', color: ALLOCATION_COLORS[allocations.length % ALLOCATION_COLORS.length], allocation_type: 'fixed' });
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium"
                            >
                              Add Segment
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAccountId(account.id);
                                setEditAccount({
                                  name: account.name,
                                  type: account.type,
                                  institution: account.institution || '',
                                  notes: account.notes || '',
                                  is_shared: account.is_shared,
                                });
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingAccountId(account.id);
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                            >
                              Delete
                            </button>
                          </div>

                          {account.type === 'investment' && (
                            <div className="px-4 sm:px-6 py-4 bg-indigo-50 border-b border-indigo-100 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700">
                                    Portfolio Composition (Optional)
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Keep this account static with manual balance snapshots, or
                                    enable portfolio + live pricing to auto-update from market
                                    quotes.
                                  </p>
                                </div>
                                {account.investment_portfolio_enabled &&
                                  account.investment_live_pricing_enabled && (
                                    <p className="text-xs text-gray-500">
                                      {quotesLoading
                                        ? 'Refreshing quotes...'
                                        : quotesLastUpdated
                                          ? `Quotes refreshed ${formatDateTime(quotesLastUpdated)}`
                                          : 'Quotes not loaded yet'}
                                    </p>
                                  )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={account.investment_portfolio_enabled}
                                    disabled={updatingInvestmentSettings}
                                    onChange={(e) =>
                                      handleUpdateInvestmentSettings(account.id, {
                                        investment_portfolio_enabled: e.target.checked,
                                        investment_live_pricing_enabled: e.target.checked
                                          ? account.investment_live_pricing_enabled
                                          : false,
                                      })
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  Track portfolio composition
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={account.investment_live_pricing_enabled}
                                    disabled={
                                      updatingInvestmentSettings ||
                                      !account.investment_portfolio_enabled
                                    }
                                    onChange={(e) =>
                                      handleUpdateInvestmentSettings(account.id, {
                                        investment_live_pricing_enabled: e.target.checked,
                                      })
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  Auto-update from live market prices (15 min)
                                </label>
                              </div>

                              {!account.investment_portfolio_enabled ? (
                                <p className="text-xs text-gray-500">
                                  Portfolio tracking is off. This account behaves like a static
                                  balance account and only changes when you record manual snapshots.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {quotesError && account.investment_live_pricing_enabled && (
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                      {quotesError}
                                    </p>
                                  )}
                                  <div className="overflow-x-auto bg-white border rounded-lg">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                          <th className="py-2 px-3 font-medium">Symbol</th>
                                          <th className="py-2 px-3 font-medium text-right">Shares</th>
                                          <th className="py-2 px-3 font-medium text-right">Price</th>
                                          <th className="py-2 px-3 font-medium text-right">Value</th>
                                          <th className="py-2 px-3 font-medium text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {holdings.length === 0 ? (
                                          <tr>
                                            <td colSpan={5} className="py-3 px-3 text-gray-400">
                                              No holdings yet. Add symbols below.
                                            </td>
                                          </tr>
                                        ) : (
                                          holdings.map((holding) => {
                                            const normalizedSymbol = String(holding.symbol || '')
                                              .toUpperCase();
                                            const isCashHolding =
                                              normalizedSymbol === CASH_HOLDING_SYMBOL;
                                            const quote = quotesBySymbol[normalizedSymbol];
                                            const price = isCashHolding
                                              ? 1
                                              : quote?.price ?? null;
                                            const marketValue =
                                              price !== null
                                                ? Number(holding.shares) * Number(price)
                                                : null;
                                            const isEditingHolding = editingHoldingId === holding.id;
                                            return (
                                              <tr key={holding.id} className="border-b border-gray-50">
                                                <td className="py-2 px-3 font-medium text-gray-900">
                                                  {isEditingHolding ? (
                                                    <input
                                                      type="text"
                                                      value={editHolding.symbol}
                                                      onChange={(e) =>
                                                        setEditHolding((prev) => ({
                                                          ...prev,
                                                          symbol: e.target.value.toUpperCase(),
                                                        }))
                                                      }
                                                      className="px-2 py-1 border rounded bg-white text-gray-900 w-24"
                                                    />
                                                  ) : (
                                                    isCashHolding ? 'Cash' : holding.symbol
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-right text-gray-700">
                                                  {isEditingHolding ? (
                                                    <input
                                                      type="number"
                                                      step="0.000001"
                                                      value={editHolding.shares}
                                                      onChange={(e) =>
                                                        setEditHolding((prev) => ({
                                                          ...prev,
                                                          shares: e.target.value,
                                                        }))
                                                      }
                                                      className="px-2 py-1 border rounded bg-white text-gray-900 w-24 text-right"
                                                    />
                                                  ) : (
                                                    isCashHolding
                                                      ? formatCurrency(Number(holding.shares))
                                                      : Number(holding.shares).toLocaleString('en-US', {
                                                          minimumFractionDigits: 0,
                                                          maximumFractionDigits: 6,
                                                        })
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-right text-gray-700">
                                                  {price !== null ? formatCurrency(Number(price)) : '—'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-medium text-gray-900">
                                                  {marketValue !== null
                                                    ? formatCurrency(marketValue)
                                                    : '—'}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <div className="flex justify-end gap-2">
                                                    {isEditingHolding ? (
                                                      <>
                                                        <button
                                                          onClick={() =>
                                                            handleUpdateHolding(
                                                              account.id,
                                                              holding.id
                                                            )
                                                          }
                                                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                                        >
                                                          Save
                                                        </button>
                                                        <button
                                                          onClick={() => setEditingHoldingId(null)}
                                                          className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                                                        >
                                                          Cancel
                                                        </button>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <button
                                                          onClick={() => {
                                                            setEditingHoldingId(holding.id);
                                                            setEditHolding({
                                                              symbol: holding.symbol,
                                                              shares: String(holding.shares),
                                                            });
                                                          }}
                                                          className="text-xs text-blue-600 hover:text-blue-800"
                                                        >
                                                          Edit
                                                        </button>
                                                        <button
                                                          onClick={() =>
                                                            handleDeleteHolding(
                                                              account.id,
                                                              holding.id
                                                            )
                                                          }
                                                          className="text-xs text-red-500 hover:text-red-700"
                                                        >
                                                          Remove
                                                        </button>
                                                      </>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Symbol
                                      </label>
                                      <input
                                        type="text"
                                        value={holdingDraft.symbol}
                                        onChange={(e) =>
                                          setHoldingDraft(account.id, {
                                            symbol: e.target.value.toUpperCase(),
                                          })
                                        }
                                        placeholder="e.g. VOO or CASH"
                                        className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 w-32"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Shares / Cash Amount
                                      </label>
                                      <input
                                        type="number"
                                        step="0.000001"
                                        value={holdingDraft.shares}
                                        onChange={(e) =>
                                          setHoldingDraft(account.id, {
                                            shares: e.target.value,
                                          })
                                        }
                                        placeholder="0"
                                        className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 w-32"
                                      />
                                    </div>
                                    <button
                                      onClick={() => handleAddHolding(account.id)}
                                      disabled={
                                        savingHolding ||
                                        !holdingDraft.symbol.trim() ||
                                        !holdingDraft.shares
                                      }
                                      className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      {savingHolding ? 'Saving...' : 'Add Holding'}
                                    </button>
                                    <button
                                      onClick={() => handleAddCashHolding(account.id)}
                                      disabled={
                                        savingHolding || !holdingDraft.shares || hasCashHolding
                                      }
                                      className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      {hasCashHolding
                                        ? 'Cash Added'
                                        : savingHolding
                                          ? 'Saving...'
                                          : 'Add Cash'}
                                    </button>
                                  </div>

                                  <p className="text-xs text-gray-500">
                                    Tip: Add uninvested balance as CASH (amount in dollars) so it is
                                    included in live portfolio total.
                                  </p>

                                  {hasLiveBalance && livePortfolioSummary?.value !== null && (
                                    <p className="text-xs text-indigo-700">
                                      Live computed total:{' '}
                                      {formatCurrency(livePortfolioSummary?.value ?? 0)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {autoAdjustBalancesFromIncome &&
                            latestManualBalance !== null &&
                            incomeAdjustment &&
                            incomeAdjustment.amount !== 0 && (
                              <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <p className="text-sm text-blue-800">
                                    Unrecorded adjustment{' '}
                                    <span className="font-semibold">
                                      {incomeAdjustment.amount >= 0 ? '+' : ''}
                                      {formatCurrency(incomeAdjustment.amount)}
                                    </span>{' '}
                                    from {incomeAdjustment.entryCount} income entr
                                    {incomeAdjustment.entryCount === 1 ? 'y' : 'ies'} after{' '}
                                    {formatDate(incomeAdjustment.snapshotDate)}.
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSnapshotAccountId(account.id);
                                      setNewSnapshot({
                                        balance:
                                          latestBalance !== null
                                            ? latestBalance.toFixed(2)
                                            : '',
                                        snapshot_date: new Date()
                                          .toISOString()
                                          .split('T')[0],
                                        notes: 'Applied unrecorded income adjustment',
                                      });
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
                                  >
                                    Prefill adjusted balance
                                  </button>
                                </div>
                              </div>
                            )}

                          {autoAdjustBalancesFromIncome &&
                            latestManualBalance === null &&
                            relatedIncomeEntryCount > 0 && (
                              <div className="px-4 sm:px-6 py-3 bg-amber-50 border-b border-amber-100">
                                <p className="text-sm text-amber-800">
                                  Income entries exist for this account, but no manual balance
                                  snapshot has been recorded yet. Record a baseline balance to
                                  start automatic adjustments.
                                </p>
                              </div>
                            )}

                          {/* Edit account form */}
                          {isEditing && (
                            <div className="px-4 sm:px-6 py-4 bg-yellow-50 border-b border-yellow-100">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Edit Account</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  value={editAccount.name}
                                  onChange={e => setEditAccount(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Account name"
                                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                />
                                <select
                                  value={editAccount.type}
                                  onChange={e => setEditAccount(prev => ({ ...prev, type: e.target.value }))}
                                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                >
                                  {ACCOUNT_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={editAccount.institution}
                                  onChange={e => setEditAccount(prev => ({ ...prev, institution: e.target.value }))}
                                  placeholder="Institution"
                                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                />
                                <input
                                  type="text"
                                  value={editAccount.notes}
                                  onChange={e => setEditAccount(prev => ({ ...prev, notes: e.target.value }))}
                                  placeholder="Notes"
                                  className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                />
                              </div>
                              <div className="mt-3 flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={editAccount.is_shared}
                                    onChange={e => setEditAccount(prev => ({ ...prev, is_shared: e.target.checked }))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  Share with partner
                                </label>
                                <div className="flex-1" />
                                <button
                                  onClick={() => setEditingAccountId(null)}
                                  className="text-sm text-gray-600 hover:text-gray-900"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleUpdateAccount(account.id)}
                                  className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Add Snapshot form */}
                          {snapshotAccountId === account.id && (
                            <div className="px-4 sm:px-6 py-4 bg-green-50 border-b border-green-100">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Record Balance</h4>
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Balance *</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newSnapshot.balance}
                                    onChange={e => setNewSnapshot(prev => ({ ...prev, balance: e.target.value }))}
                                    placeholder="0.00"
                                    className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 w-40"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                                  <input
                                    type="date"
                                    value={newSnapshot.snapshot_date}
                                    onChange={e => setNewSnapshot(prev => ({ ...prev, snapshot_date: e.target.value }))}
                                    className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                  />
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                                  <input
                                    type="text"
                                    value={newSnapshot.notes}
                                    onChange={e => setNewSnapshot(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSnapshotAccountId(null)}
                                    className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddSnapshot(account.id)}
                                    disabled={addingSnapshot || !newSnapshot.balance}
                                    className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {addingSnapshot ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Add Allocation form */}
                          {allocationAccountId === account.id && (
                            <div className="px-4 sm:px-6 py-4 bg-purple-50 border-b border-purple-100">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Add Money Segment</h4>
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Label *</label>
                                  <input
                                    type="text"
                                    value={newAllocation.label}
                                    onChange={e => setNewAllocation(prev => ({ ...prev, label: e.target.value }))}
                                    placeholder="e.g. Emergency Fund"
                                    className="px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 w-48"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">
                                    {newAllocation.allocation_type === 'percentage' ? 'Percent (%)' : 'Amount ($)'}
                                  </label>
                                  <div className="flex">
                                    <input
                                      type="number"
                                      step={newAllocation.allocation_type === 'percentage' ? '0.1' : '0.01'}
                                      value={newAllocation.amount}
                                      onChange={e => setNewAllocation(prev => ({ ...prev, amount: e.target.value }))}
                                      placeholder={newAllocation.allocation_type === 'percentage' ? '0' : '0.00'}
                                      className="px-3 py-2 text-sm border rounded-l-lg bg-white text-gray-900 w-28"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setNewAllocation(prev => ({
                                        ...prev,
                                        allocation_type: prev.allocation_type === 'fixed' ? 'percentage' : 'fixed',
                                        amount: '',
                                      }))}
                                      className="px-2.5 py-2 text-xs font-semibold border border-l-0 rounded-r-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      title="Toggle between $ and %"
                                    >
                                      {newAllocation.allocation_type === 'percentage' ? '%' : '$'}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Color</label>
                                  <div className="flex gap-1">
                                    {ALLOCATION_COLORS.slice(0, 6).map(c => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => setNewAllocation(prev => ({ ...prev, color: c }))}
                                        className={`w-7 h-7 rounded-full border-2 ${
                                          newAllocation.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setAllocationAccountId(null)}
                                    className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddAllocation(account.id)}
                                    disabled={addingAllocation || !newAllocation.label.trim()}
                                    className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                  >
                                    {addingAllocation ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="px-4 sm:px-6 py-4 space-y-6">
                            {/* ── Allocations / Segments ── */}
                            {allocations.length > 0 && latestBalance !== null && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Money Segments</h4>
                                {/* Visual bar */}
                                <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 mb-3">
                                  {allocations.map(alloc => {
                                    const resolved = resolveAllocAmount(alloc, latestBalance);
                                    const pct = latestBalance && latestBalance > 0
                                      ? (resolved / latestBalance) * 100
                                      : 0;
                                    return (
                                      <div
                                        key={alloc.id}
                                        className="h-full transition-all"
                                        style={{
                                          width: `${Math.min(pct, 100)}%`,
                                          backgroundColor: alloc.color || '#94A3B8',
                                        }}
                                        title={`${alloc.label}: ${formatCurrency(resolved)}${alloc.allocation_type === 'percentage' ? ` (${alloc.amount}%)` : ''}`}
                                      />
                                    );
                                  })}
                                  {unallocated > 0 && latestBalance > 0 && (
                                    <div
                                      className="h-full bg-gray-300"
                                      style={{ width: `${(unallocated / latestBalance) * 100}%` }}
                                      title={`Unallocated: ${formatCurrency(unallocated)}`}
                                    />
                                  )}
                                </div>

                                {/* Allocation list */}
                                <div className="space-y-2">
                                  {allocations.map(alloc => (
                                    <div key={alloc.id} className="flex items-center gap-3">
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: alloc.color || '#94A3B8' }}
                                      />
                                      {editingAllocId === alloc.id ? (
                                        <div className="flex flex-wrap items-center gap-2 flex-1">
                                          <input
                                            type="text"
                                            value={editAlloc.label}
                                            onChange={e => setEditAlloc(prev => ({ ...prev, label: e.target.value }))}
                                            className="px-2 py-1 text-sm border rounded bg-white text-gray-900 w-36"
                                          />
                                          <div className="flex">
                                            <input
                                              type="number"
                                              step={editAlloc.allocation_type === 'percentage' ? '0.1' : '0.01'}
                                              value={editAlloc.amount}
                                              onChange={e => setEditAlloc(prev => ({ ...prev, amount: e.target.value }))}
                                              className="px-2 py-1 text-sm border rounded-l bg-white text-gray-900 w-24"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => setEditAlloc(prev => ({
                                                ...prev,
                                                allocation_type: prev.allocation_type === 'fixed' ? 'percentage' : 'fixed',
                                                amount: '',
                                              }))}
                                              className="px-2 py-1 text-xs font-semibold border border-l-0 rounded-r bg-gray-100 text-gray-600 hover:bg-gray-200"
                                              title="Toggle between $ and %"
                                            >
                                              {editAlloc.allocation_type === 'percentage' ? '%' : '$'}
                                            </button>
                                          </div>
                                          <button
                                            onClick={() => handleUpdateAllocation(account.id, alloc.id)}
                                            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => setEditingAllocId(null)}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-sm text-gray-700 flex-1">{alloc.label}</span>
                                          <span className="text-sm font-medium text-gray-900">
                                            {alloc.allocation_type === 'percentage' ? (
                                              <>
                                                {Number(alloc.amount)}%
                                                {latestBalance !== null && (
                                                  <span className="text-gray-400 font-normal ml-1">
                                                    ({formatCurrency(resolveAllocAmount(alloc, latestBalance))})
                                                  </span>
                                                )}
                                              </>
                                            ) : (
                                              formatCurrency(Number(alloc.amount))
                                            )}
                                          </span>
                                          <button
                                            onClick={() => {
                                              setEditingAllocId(alloc.id);
                                              setEditAlloc({
                                                label: alloc.label,
                                                amount: String(alloc.amount),
                                                color: alloc.color || '',
                                                allocation_type: alloc.allocation_type,
                                              });
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteAllocation(account.id, alloc.id)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                          >
                                            Remove
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                  {/* Unallocated row */}
                                  <div className="flex items-center gap-3 border-t pt-2 mt-2">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-300" />
                                    <span className="text-sm text-gray-500 flex-1">Unallocated</span>
                                    <span className={`text-sm font-medium ${unallocated < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                      {formatCurrency(unallocated)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Balance History ── */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Balance History
                                {snapshots.length > 0 && (
                                  <span className="font-normal text-gray-400 ml-2">
                                    ({snapshots.length} record{snapshots.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </h4>
                              {snapshots.length === 0 ? (
                                <p className="text-sm text-gray-400">
                                  No balance recorded yet. Click &ldquo;Update Balance&rdquo; to record your first snapshot.
                                </p>
                              ) : (
                                <>
                                  {/* Mini chart (simple bar chart) */}
                                  {snapshots.length > 1 && (
                                    <div className="mb-4">
                                      <div className="flex items-end gap-1 h-24">
                                        {[...snapshots].reverse().slice(-20).map((snap, idx, arr) => {
                                          const balances = arr.map(s => Number(s.balance));
                                          const max = Math.max(...balances);
                                          const min = Math.min(...balances, 0);
                                          const range = max - min || 1;
                                          const height = ((Number(snap.balance) - min) / range) * 100;
                                          return (
                                            <div
                                              key={snap.id}
                                              className="flex-1 min-w-[4px] rounded-t bg-blue-400 hover:bg-blue-600 transition-colors cursor-default"
                                              style={{ height: `${Math.max(height, 2)}%` }}
                                              title={`${formatDate(snap.snapshot_date)}: ${formatCurrency(Number(snap.balance))}`}
                                            />
                                          );
                                        })}
                                      </div>
                                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>
                                          {formatDate([...snapshots].reverse().slice(-20)[0]?.snapshot_date || '')}
                                        </span>
                                        <span>
                                          {formatDate(snapshots[0]?.snapshot_date || '')}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* History table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                          <th className="py-2 pr-4 font-medium">Date</th>
                                          <th className="py-2 pr-4 font-medium text-right">Balance</th>
                                          <th className="py-2 pr-4 font-medium text-right">Change</th>
                                          <th className="py-2 font-medium">Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {snapshots.slice(0, 10).map((snap, idx) => {
                                          const prev = snapshots[idx + 1];
                                          const changeAmt = prev
                                            ? Number(snap.balance) - Number(prev.balance)
                                            : null;
                                          return (
                                            <tr key={snap.id} className="border-b border-gray-50">
                                              <td className="py-2 pr-4 text-gray-700">
                                                {formatDate(snap.snapshot_date)}
                                              </td>
                                              <td className="py-2 pr-4 text-right font-medium text-gray-900">
                                                {formatCurrency(Number(snap.balance))}
                                              </td>
                                              <td className="py-2 pr-4 text-right">
                                                {changeAmt !== null ? (
                                                  <span className={changeAmt >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {changeAmt >= 0 ? '+' : ''}{formatCurrency(changeAmt)}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-300">—</span>
                                                )}
                                              </td>
                                              <td className="py-2 text-gray-500">
                                                {snap.notes || '—'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  {snapshots.length > 10 && (
                                    <p className="text-xs text-gray-400 mt-2">
                                      Showing latest 10 of {snapshots.length} records
                                    </p>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Notes */}
                            {account.notes && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Notes</h4>
                                <p className="text-sm text-gray-500">{account.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
