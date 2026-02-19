'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<'personal' | 'shared' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (!user) {
    return null;
  }

  const isActive = (path: string) => pathname.startsWith(path);
  const isPersonalActive = isActive('/personal');
  const isSharedActive = isActive('/shared');

  const dropdownItems = [
    { label: 'Expenses', path: 'expenses' },
    { label: 'Income', path: 'income' },
    { label: 'Accounts', path: 'accounts' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-1 sm:space-x-4 lg:space-x-6 min-w-max" ref={dropdownRef}>
            <Link
              href="/dashboard"
              className={`flex items-center text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                isActive('/dashboard') ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>

            {/* Shared Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'shared' ? null : 'shared')}
                className={`flex items-center gap-1 text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                  isSharedActive ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Shared
                <svg className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'shared' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'shared' && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {dropdownItems.map((item) => (
                    <Link
                      key={item.path}
                      href={`/shared/${item.path}`}
                      onClick={() => setOpenDropdown(null)}
                      className={`block px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        pathname === `/shared/${item.path}` ? 'text-blue-700 font-medium bg-blue-50' : 'text-gray-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Personal Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'personal' ? null : 'personal')}
                className={`flex items-center gap-1 text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                  isPersonalActive ? 'text-purple-700 font-semibold bg-purple-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Personal
                <svg className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'personal' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'personal' && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {dropdownItems.map((item) => (
                    <Link
                      key={item.path}
                      href={`/personal/${item.path}`}
                      onClick={() => setOpenDropdown(null)}
                      className={`block px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        pathname === `/personal/${item.path}` ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/settings"
              className={`flex items-center text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                isActive('/settings') ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Settings
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
