import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/**
 * Plaid API client. Reads credentials from the environment:
 *   PLAID_CLIENT_ID   - your Plaid client id
 *   PLAID_SECRET      - the secret for the chosen environment
 *   PLAID_ENV         - 'sandbox' (default) | 'production'
 *
 * Sandbox works with Plaid's test sandbox secret and fake institutions, so the
 * whole flow can be developed before any real keys/billing are set up.
 */
const PLAID_ENV = ((process.env.PLAID_ENV || 'sandbox').trim()) as keyof typeof PlaidEnvironments;

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

let cached: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (cached) return cached;

  const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  cached = new PlaidApi(configuration);
  return cached;
}
