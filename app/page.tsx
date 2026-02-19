import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Finance App</h1>
        <div className="space-y-4">
          <Link 
            href="/dashboard" 
            className="block p-6 border rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
            <p className="text-gray-600">View your financial summary and budget tracking</p>
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 border rounded-lg bg-blue-50 border-blue-200">
              <h2 className="text-xl font-semibold mb-3 text-blue-800">Shared</h2>
              <div className="space-y-2">
                <Link href="/shared/expenses" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Expenses</span>
                  <p className="text-sm text-gray-500">Joint/shared household expenses</p>
                </Link>
                <Link href="/shared/income" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Income</span>
                  <p className="text-sm text-gray-500">Shared income tracking</p>
                </Link>
                <Link href="/shared/accounts" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Accounts</span>
                  <p className="text-sm text-gray-500">Shared account balances</p>
                </Link>
              </div>
            </div>

            <div className="p-6 border rounded-lg bg-purple-50 border-purple-200">
              <h2 className="text-xl font-semibold mb-3 text-purple-800">Personal</h2>
              <div className="space-y-2">
                <Link href="/personal/expenses" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Expenses</span>
                  <p className="text-sm text-gray-500">Personal private expenses</p>
                </Link>
                <Link href="/personal/income" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Income</span>
                  <p className="text-sm text-gray-500">Personal income tracking</p>
                </Link>
                <Link href="/personal/accounts" className="block p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <span className="font-medium">Accounts</span>
                  <p className="text-sm text-gray-500">Personal account balances</p>
                </Link>
              </div>
            </div>
          </div>

          <Link 
            href="/settings" 
            className="block p-6 border rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Settings</h2>
            <p className="text-gray-600">Manage categories, budgets, rules, and shared access</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
