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
          <Link 
            href="/transactions" 
            className="block p-6 border rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Transactions</h2>
            <p className="text-gray-600">View and manage your transactions</p>
          </Link>
          <Link 
            href="/accounts" 
            className="block p-6 border rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Account Balances</h2>
            <p className="text-gray-600">Track balances and segment money across your accounts</p>
          </Link>
          <Link
            href="/income"
            className="block p-6 border rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold mb-2">Income</h2>
            <p className="text-gray-600">Track monthly income and where each deposit lands</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

