'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';

export default function PengaturanPage() {
  const [token, setToken] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data, error: apiError } = useApi(
    token ? 'settings' : null,
    () => api.getSettings(token),
    { ttl: 60_000 }
  );

  useEffect(() => {
    if (data) setForm(data);
    if (apiError) setError(apiError);
  }, [data, apiError]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.updateSettings(token, form);
      setSuccess('Pengaturan berhasil disimpan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { key: 'STORE_NAME', label: 'Nama Toko', placeholder: 'Kasir Pintar' },
    { key: 'WA_OWNER_NUMBERS', label: 'Nomor WhatsApp Owner (pisah dengan koma)', placeholder: '6281234567890' },
    { key: 'WA_LARGE_SALE_THRESHOLD', label: 'Threshold Notifikasi Penjualan Besar (Rp)', placeholder: '500000' },
    { key: 'WA_LARGE_EXPENSE_THRESHOLD', label: 'Threshold Notifikasi Pengeluaran Besar (Rp)', placeholder: '200000' },
    { key: 'QRIS_STATIC_CODE', label: 'QRIS Static Code', placeholder: '00020101021126...' },
  ];

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan</h1>
          <p className="text-sm text-slate-500">Konfigurasi toko &amp; notifikasi WhatsApp</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{success}</div>}

        <form onSubmit={save} className="card p-6 space-y-4 max-w-2xl">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">{field.label}</label>
              {field.key === 'QRIS_STATIC_CODE' ? (
                <textarea
                  className="input min-h-24 font-mono text-xs"
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  className="input"
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Catatan: perubahan WA_OWNER_NUMBERS &amp; threshold berlaku untuk notifikasi WhatsApp. Untuk cron &amp; JWT, ubah file <code className="rounded bg-amber-100 px-1">.env</code>.
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
