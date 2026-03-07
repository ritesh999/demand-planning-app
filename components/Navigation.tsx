'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Upload,
  TrendingUp,
  Package,
  Info,
  HardHat,
} from 'lucide-react';

const links = [
  { href: '/',          label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/data',      label: 'Data Upload',         icon: Upload },
  { href: '/forecast',  label: 'Forecasting',         icon: TrendingUp },
  { href: '/inventory', label: 'Inventory Optimiser', icon: Package },
  { href: '/about',     label: 'About',               icon: Info },
];

export default function Navigation() {
  const path = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 text-white flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <HardHat className="w-7 h-7 text-blue-400 shrink-0" />
        <div>
          <p className="font-bold text-sm leading-tight">Demand Planning</p>
          <p className="text-[11px] text-slate-400 leading-tight">Construction Analytics</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700 text-[11px] text-slate-500">
        v0.5.0 · Vercel / Next.js
      </div>
    </aside>
  );
}
