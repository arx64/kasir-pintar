'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useApi, invalidateApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { api, type StockLog, type StockMovement } from '@/lib/api';
import { formatDate } from '@/lib/format';

const LOG_TYPES = ['SALE', 'REFUND', 'ADJUSTMENT', 'RESTOCK', 'CANCEL'] as const;

export default function StokPage() {
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<'logs' | 'movements'>('logs');
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filterType, setFilterType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const logsKey = token ? `stock-logs?type=${filterType}&from=${from}&to=${to}` : null;
  const { data: logsData, error: logsError } = useApi(
    logsKey,
    () => api.stockLogs(token, {
      type: filterType || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 100,
    }),
    { ttl: 15_000 }
  );
  useEffect(() => {
    if (logsData) setLogs(logsData.items);
    if (logsError) setError(logsError);
  }, [logsData, logsError]);

  const mvKey = token ? 'stock-movements' : null;
  const { data: mvData, error: mvError } = useApi(
    mvKey,
    () => api.stockMovements(token),
    { ttl: 30_000 }
  );
  useEffect(() => {
    if (mvData) setMovements(mvData);
    if (mvError) setError(mvError);
  }, [mvData, mvError]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      invalidateApi(logsKey || '');
      invalidateApi(mvKey || '');
      const [logRes, mvRes] = await Promise.all([
        api.stockLogs(token, {
          type: filterType || undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        }),
        api.stockMovements(token),
      ]);
      setLogs(logRes.items);
      setMovements(mvRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, filterType, from, to, logsKey, mvKey]);

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Stok</h1>
          <p className="text-sm text-slate-500">Pelacak pergerakan stok barang masuk & keluar</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-2">
          <button
            className={`btn px-4 py-2 text-sm ${tab === 'logs' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => setTab('logs')}
          >
            Riwayat Aktivitas
          </button>
          <button
            className={`btn px-4 py-2 text-sm ${tab === 'movements' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => setTab('movements')}
          >
            Ringkasan Per Produk
          </button>
        </div>

        {tab === 'logs' && (
          <>
            <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipe</label>
                <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Semua</option>
                  {LOG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-slate-500 mb-1">Dari</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Sampai</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              <div className="flex items-end"><button className="btn bg-slate-100 text-slate-700 w-full" onClick={() => { setFilterType(''); setFrom(''); setTo(''); }}>Reset</button></div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Waktu</th>
                      <th className="px-4 py-3 text-left">Produk</th>
                      <th className="px-4 py-3 text-center">Tipe</th>
                      <th className="px-4 py-3 text-right">Selisih</th>
                      <th className="px-4 py-3 text-right">Sebelum</th>
                      <th className="px-4 py-3 text-right">Sesudah</th>
                      <th className="px-4 py-3 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const open = expanded === log.id;
                      return (
                        <Fragment key={log.id}>
                          <tr
                            className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                            onClick={() => setExpanded(open ? null : log.id)}
                          >
                            <td className="px-4 py-3 text-xs text-slate-600">{formatDate(log.createdAt)}</td>
                            <td className="px-4 py-3 font-medium">{log.product?.name || log.productId}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`badge ${
                                log.type === 'SALE' ? 'bg-blue-100 text-blue-700'
                                : log.type === 'RESTOCK' ? 'bg-brand-100 text-brand-700'
                                : log.type === 'CANCEL' || log.type === 'REFUND' ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                              }`}>{log.type}</span>
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${log.quantity >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                              {log.quantity >= 0 ? '+' : ''}{log.quantity}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">{log.before}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{log.after}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-40">{log.note || '-'}</td>
                          </tr>
                          {open && log.refId && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={7} className="px-8 py-2 text-xs text-slate-500">Referensi: {log.refId}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada aktivitas stok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'movements' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Produk</th>
                    <th className="px-4 py-3 text-left">Barcode</th>
                    <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                    <th className="px-4 py-3 text-right">Min. Stok</th>
                    <th className="px-4 py-3 text-right">Total Masuk</th>
                    <th className="px-4 py-3 text-right">Total Keluar</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.barcode || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{m.stock}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{m.minStock}</td>
                      <td className="px-4 py-3 text-right text-brand-600 font-medium">{m.totalIn}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{m.totalOut}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${m.stock <= 0 ? 'bg-red-100 text-red-700' : m.stock <= m.minStock ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'}`}>
                          {m.stock <= 0 ? 'Habis' : m.stock <= m.minStock ? 'Menipis' : 'Aman'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada produk.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
