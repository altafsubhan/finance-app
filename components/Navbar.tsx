'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (!user) {
    return null;
  }

  const isActive = (path: string) => pathname.startsWith(path);

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Record', href: '/record', activeColor: 'green' },
    { label: 'Inbox', href: '/inbox' },
    { label: 'Expenses', href: '/expenses' },
    { label: 'Income', href: '/income' },
    { label: 'Accounts', href: '/accounts' },
    { label: 'Reconcile', href: '/reconcile' },
    { label: 'Settings', href: '/settings' },
  ];

  const getActiveClasses = (href: string, activeColor?: string) => {
    const color = activeColor || 'blue';
    if (isActive(href)) {
      return `text-${color}-700 font-semibold bg-${color}-50`;
    }
    return 'text-gray-700 hover:text-gray-900 hover:bg-gray-50';
  };

  const userInitial = (user.email?.[0] || 'U').toUpperCase();

  return (
    <nav className="bg-white border-b border-gray-200 relative z-40">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">

          {/* Mobile: hamburger */}
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

          {/* Desktop: horizontal nav */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center text-sm sm:text-base px-2 py-1 rounded-md whitespace-nowrap ${getActiveClasses(link.href, link.activeColor)}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop: user info */}
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              Logout
            </button>
          </div>

          {/* Mobile: user avatar */}
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

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="py-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-2.5 text-sm font-medium rounded-md mx-2 ${getActiveClasses(link.href, link.activeColor)}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
