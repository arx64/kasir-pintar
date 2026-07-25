'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@kasir.com');
  const [password, setPassword] = useState('owner123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login({ email, password });
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('user', JSON.stringify(user));
      router.push(user.role === 'OWNER' ? '/dashboard' : '/kasir');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white text-xl font-bold mb-3">
            K
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Kasir Pintar</h1>
          <p className="text-sm text-slate-500">Smart POS dengan WhatsApp</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-medium mb-1">Akun demo:</p>
          <p>Owner: owner@kasir.com / owner123</p>
          <p>Kasir: kasir@kasir.com / kasir123</p>
        </div>
      </div>
    </div>
  );
}
