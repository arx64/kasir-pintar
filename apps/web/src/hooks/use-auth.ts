'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppUser } from '@/lib/api';

export function useAuth(allowedRoles?: Array<'OWNER' | 'KASIR'>) {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const allowedKey = allowedRoles?.join(',');

  useEffect(() => {
    const t = window.localStorage.getItem('token');
    const u = window.localStorage.getItem('user');
    if (!t || !u) {
      router.replace('/login');
      return;
    }
    try {
      const parsed = JSON.parse(u) as AppUser;
      if (allowedRoles && !allowedRoles.includes(parsed.role)) {
        router.replace(parsed.role === 'OWNER' ? '/dashboard' : '/kasir');
        return;
      }
      setUser(parsed);
      setToken(t);
      setReady(true);
    } catch {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('user');
      router.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, allowedKey]);

  return { user, token, ready };
}

export function logout(router: ReturnType<typeof useRouter>) {
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
  router.replace('/login');
}

export function readRole(): 'OWNER' | 'KASIR' {
  if (typeof window === 'undefined') return 'KASIR';
  try {
    const u = window.localStorage.getItem('user');
    return u ? (JSON.parse(u).role ?? 'KASIR') : 'KASIR';
  } catch {
    return 'KASIR';
  }
}