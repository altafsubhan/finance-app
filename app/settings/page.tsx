import Link from 'next/link';
import SharedAccessPanel from '@/components/SharedAccessPanel';
import BalanceAutomationSettings from '@/components/BalanceAutomationSettings';

export default function SettingsPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage budgets, categories, payment methods, and automation rules.
          </p>
        </div>

        <SharedAccessPanel />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BalanceAutomationSettings />

          <section className="bg-white border rounded-lg p-6 space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Budgets &amp; Categories</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage categories, privacy, default budgets, and budget periods in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/budgets"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Manage budgets &amp; categories
              </Link>
            </div>
          </section>

          <section className="bg-white border rounded-lg p-6 space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Payment Methods</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add, rename, or remove payment method labels.
              </p>
            </div>
            <Link
              href="/payment-methods"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Manage payment methods
            </Link>
          </section>

          <section className="bg-white border rounded-lg p-6 space-y-3 md:col-span-2">
            <div>
              <h2 className="text-xl font-semibold">Rules</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure auto-category rules and blocklist patterns.
              </p>
            </div>
            <Link
              href="/rules"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Manage rules
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
