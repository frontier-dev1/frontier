// app/components/Header.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Incidents', href: '/' },
    { label: 'AI News', href: '/ai_news' },
    { label: 'About', href: '/about' },
    { label: 'Admin', href: '/admin' },
  ];

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <Link href="/" className="flex items-center space-x-2 font-bold text-xl tracking-tight">
          <span className="text-red-500">Frontier</span>
          <span>AI Incidents</span>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-foreground/80 ${
                pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
