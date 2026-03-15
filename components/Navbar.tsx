'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<'personal' | 'shared' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<'shared' | 'personal' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
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
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setOpenDropdown(null);
    setMobileExpanded(null);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (openDropdown || userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown, userMenuOpen]);

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

  const subPages = [
    { label: 'Expenses', path: 'expenses' },
    { label: 'Income', path: 'income' },
    { label: 'Accounts', path: 'accounts' },
  ];

  const userInitial = (user.email?.[0] || 'U').toUpperCase();

  return (
    <nav className="bg-white border-b border-gray-200 relative z-40">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">

          {/* ── Mobile: hamburger ── */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setUserMenuOpen(false); }}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* ── Desktop: horizontal nav ── */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-6" ref={dropdownRef}>
            <Link
              href="/dashboard"
              className={`flex items-center text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                isActive('/dashboard') ? 'text-blue-700 font-semibold bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/record"
              className={`flex items-center text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${
                isActive('/record') ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              + Record
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
                  {subPages.map((item) => (
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
                  {subPages.map((item) => (
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

          {/* ── Desktop: user info ── */}
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              Logout
            </button>
          </div>

          {/* ── Mobile: user avatar ── */}
          <div className="flex items-center md:hidden" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setMobileMenuOpen(false); }}
              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 hover:bg-gray-300"
              aria-label="User menu"
            >
              {userInitial}
            </button>

            {userMenuOpen && (
              <div className="absolute right-2 top-12 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile menu panel ── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="py-2 space-y-1">
            <Link
              href="/dashboard"
              className={`block px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${
                isActive('/dashboard') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/record"
              className={`block px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${
                isActive('/record') ? 'text-green-700 bg-green-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              + Record
            </Link>

            {/* Shared section */}
            <div>
              <button
                onClick={() => setMobileExpanded(mobileExpanded === 'shared' ? null : 'shared')}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${
                  isSharedActive ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={{ width: 'calc(100% - 1rem)' }}
              >
                Shared
                <svg className={`w-4 h-4 transition-transform ${mobileExpanded === 'shared' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileExpanded === 'shared' && (
                <div className="ml-4 space-y-1 mt-1">
                  {subPages.map((item) => (
                    <Link
                      key={item.path}
                      href={`/shared/${item.path}`}
                      className={`block px-4 py-2 text-sm rounded-md mx-2 ${
                        pathname === `/shared/${item.path}` ? 'text-blue-700 font-medium bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Personal section */}
            <div>
              <button
                onClick={() => setMobileExpanded(mobileExpanded === 'personal' ? null : 'personal')}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${
                  isPersonalActive ? 'text-purple-700 bg-purple-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={{ width: 'calc(100% - 1rem)' }}
              >
                Personal
                <svg className={`w-4 h-4 transition-transform ${mobileExpanded === 'personal' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileExpanded === 'personal' && (
                <div className="ml-4 space-y-1 mt-1">
                  {subPages.map((item) => (
                    <Link
                      key={item.path}
                      href={`/personal/${item.path}`}
                      className={`block px-4 py-2 text-sm rounded-md mx-2 ${
                        pathname === `/personal/${item.path}` ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-600 hover:bg-gray-50'
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
              className={`block px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${
                isActive('/settings') ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
