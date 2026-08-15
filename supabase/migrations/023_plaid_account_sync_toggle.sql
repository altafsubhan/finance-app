-- Migration 023: Per-account sync toggle for plaid_accounts
--
-- Adds is_synced boolean to plaid_accounts so individual accounts (e.g. a
-- checking account that arrived with a Wells Fargo credit-card link) can be
-- excluded from future Plaid syncs without unlinking the whole institution.
-- Defaults to true so all existing linked accounts continue syncing as before.

ALTER TABLE public.plaid_accounts
  ADD COLUMN IF NOT EXISTS is_synced BOOLEAN NOT NULL DEFAULT true;
