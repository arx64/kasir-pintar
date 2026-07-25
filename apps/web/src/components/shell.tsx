'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout, useAuth } from '@/hooks/use-auth';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Role = 'OWNER' | 'KASIR';
type MenuItem = { href: string; label: string };

function buildMenu(role: Role): MenuItem[] {
  const ownerMenu: MenuItem[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/produk', label: 'Produk' },
    { href: '/stok', label: 'Stok' },
    { href: '/penjualan', label: 'Penjualan' },
    { href: '/pengeluaran', label: 'Pengeluaran' },
    { href: '/laporan', label: 'Laporan' },
    { href: '/permintaan', label: 'Permintaan' },
    { href: '/pengguna', label: 'Pengguna' },
    { href: '/whatsapp', label: 'WhatsApp' },
    { href: '/pengaturan', label: 'Pengaturan' },
  ];

  const kasirMenu: MenuItem[] = [
    { href: '/kasir', label: 'Kasir' },
    { href: '/produk', label: 'Stok' },
    { href: '/penjualan', label: 'Riwayat' },
    { href: '/pengeluaran', label: 'Pengeluaran' },
  ];

  if (role === 'OWNER') {
    return ownerMenu;
  }

  const hasKasirEntry = kasirMenu.some((item) => item.href === '/kasir');
  return hasKasirEntry ? kasirMenu : [{ href: '/kasir', label: 'Kasir' }, ...kasirMenu];
}

export function Shell({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth(allowedRoles);

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">Memuat...</div>
    );
  }

  const role = user.role as Role;
  const menu = buildMenu(role);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-100 bg-white">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">K</div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">Kasir Pintar</p>
              <p className="text-xs text-slate-500">{role}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menu.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as never}
                className={cn(
                  'block rounded-xl px-4 py-3 text-sm font-medium transition',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-4 py-2 text-xs text-slate-500">
            <p className="font-medium text-slate-700">{user.name}</p>
            <p>{user.email}</p>
          </div>
          <button
            onClick={() => logout(router)}
            className="btn w-full mt-2 bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-full overflow-x-hidden">
        <header className="md:hidden flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">K</div>
            <span className="font-bold">Kasir Pintar</span>
          </div>
          <button onClick={() => logout(router)} className="text-sm text-slate-500">Keluar</button>
        </header>
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm transition',
                pathname?.startsWith(item.href)
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'blue';
}) {
  const tones = {
    default: 'text-slate-900',
    green: 'text-brand-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', tones[tone])}>{value}</p>
    </div>
  );
}
