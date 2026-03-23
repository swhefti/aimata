'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import { isAdminEmail } from '@/lib/admin';

interface NavBarProps {
  userEmail?: string | null;
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', adminOnly: false },
  { href: '/market', label: 'Market', adminOnly: false },
  { href: '/basket', label: 'Basket', adminOnly: false },
  { href: '/settings', label: 'Settings', adminOnly: false },
  { href: '/admin', label: 'Admin', adminOnly: true },
] as const;

export default function NavBar({ userEmail }: NavBarProps) {
  const pathname = usePathname();
  const isAdmin = isAdminEmail(userEmail);

  const visibleLinks = NAV_LINKS.filter((link) => !link.adminOnly || isAdmin);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-mata-border/60 bg-mata-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size="sm" showSubtitle={false} />
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {visibleLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-mata-orange/10 text-mata-orange'
                    : 'text-mata-text-secondary hover:bg-mata-surface hover:text-mata-text'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User area */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mata-surface border border-mata-border text-xs font-bold text-mata-text-secondary">
            {userEmail ? userEmail[0].toUpperCase() : 'U'}
          </div>
          <button
            className="text-xs font-medium text-mata-text-muted hover:text-mata-red transition-colors"
            onClick={() => {
              /* logout handler */
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
