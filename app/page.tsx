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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/expenses" className="block p-6 border rounded-lg hover:bg-gray-50 transition">
              <h2 className="text-xl font-semibold mb-2">Expenses</h2>
              <p className="text-sm text-gray-500">Track and manage all expenses</p>
            </Link>
            <Link href="/income" className="block p-6 border rounded-lg hover:bg-gray-50 transition">
              <h2 className="text-xl font-semibold mb-2">Income</h2>
              <p className="text-sm text-gray-500">Track income across accounts</p>
            </Link>
            <Link href="/accounts" className="block p-6 border rounded-lg hover:bg-gray-50 transition">
              <h2 className="text-xl font-semibold mb-2">Accounts</h2>
              <p className="text-sm text-gray-500">Manage account balances</p>
            </Link>
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
