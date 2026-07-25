'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApi, invalidateApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { api, type CustomerRequest, type CustomerRequestStatus } from '@/lib/api';
import { formatDate } from '@/lib/format';

const STATUSES: CustomerRequestStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'REJECTED'];

const STATUS_LABELS: Record<CustomerRequestStatus, string> = {
  NEW: 'Baru',
  IN_PROGRESS: 'Diproses',
  DONE: 'Selesai',
  REJECTED: 'Ditolak',
};

export default function PermintaanPage() {
  const [token, setToken] = useState('');
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');

  const key = token ? `customer-requests?status=${filterStatus}` : null;
  const { data, error: apiError } = useApi(
    key,
    () => api.customerRequests(token, filterStatus || undefined),
    { ttl: 15_000 }
  );

  useEffect(() => {
    if (data) setRequests(data);
    if (apiError) setError(apiError);
  }, [data, apiError]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      invalidateApi(key || '');
      const res = await api.customerRequests(token, filterStatus || undefined);
      setRequests(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, filterStatus, key]);

  async function handleStatus(id: string, status: CustomerRequestStatus) {
    try {
      await api.updateCustomerRequestStatus(token, id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus permintaan ini?')) return;
    try {
      await api.deleteCustomerRequest(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = requests.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<CustomerRequestStatus, number>);

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Permintaan Pelanggan</h1>
          <p className="text-sm text-slate-500">Permintaan/barang yang dikirim pelanggan via formulir publik</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATUSES.map((s) => (
            <div key={s} className="card p-5">
              <p className="text-xs text-slate-500">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold">{counts[s]}</p>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <label className="block text-xs text-slate-500 mb-1">Filter Status</label>
          <select className="input md:w-56" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requests.map((req) => (
            <div key={req.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{req.name}</p>
                  <p className="text-sm text-slate-500">{req.phone}</p>
                  <p className="text-xs text-slate-400">{formatDate(req.createdAt)}</p>
                </div>
                <span className={`badge whitespace-nowrap ${
                  req.status === 'NEW' ? 'bg-blue-100 text-blue-700'
                  : req.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700'
                  : req.status === 'DONE' ? 'bg-brand-100 text-brand-700'
                  : 'bg-red-100 text-red-700'
                }`}>{STATUS_LABELS[req.status]}</span>
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{req.message}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`btn px-3 py-1 text-xs ${req.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    onClick={() => handleStatus(req.id, s)}
                    disabled={req.status === s}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                <button
                  className="btn bg-red-50 text-red-600 px-3 py-1 text-xs hover:bg-red-100 ml-auto"
                  onClick={() => handleDelete(req.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="card p-10 text-center text-slate-400 col-span-full">Belum ada permintaan.</div>
          )}
        </div>
      </div>
    </Shell>
  );
}
