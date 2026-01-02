'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16 overflow-x-auto">
          <div className="flex space-x-2 sm:space-x-4 lg:space-x-8 min-w-max">
            <Link href="/dashboard" className="flex items-center text-sm sm:text-base text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0">
              Dashboard
            </Link>
            <Link href="/transactions" className="flex items-center text-sm sm:text-base text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0">
              Transactions
            </Link>
            <Link href="/categories" className="flex items-center text-sm sm:text-base text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0">
              Categories
            </Link>
            <Link href="/budgets" className="flex items-center text-sm sm:text-base text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0">
              Budgets
            </Link>
            <Link href="/payment-methods" className="flex items-center text-sm sm:text-base text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0">
              Payment Methods
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 ml-2 sm:ml-0">
            <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 whitespace-nowrap px-1 sm:px-0"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

