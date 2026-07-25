'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useApi, invalidateApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { readRole } from '@/hooks/use-auth';
import { api, type Sale } from '@/lib/api';
import { currency, formatDate } from '@/lib/format';

export default function PenjualanPage() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState<'OWNER' | 'KASIR'>('KASIR');
  const [sales, setSales] = useState<Sale[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const salesKey = token
    ? `sales?from=${from || ''}&to=${to || ''}&status=${status || ''}`
    : null;
  const { data: salesData, error: salesError } = useApi(
    salesKey,
    () => api.sales(token, {
      from: from || undefined,
      to: to || undefined,
      status: status || undefined,
    }),
    { ttl: 20_000 }
  );

  useEffect(() => {
    if (salesData) setSales(salesData.items);
    if (salesError) setError(salesError);
  }, [salesData, salesError]);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      invalidateApi(salesKey || '');
      const res = await api.sales(token, {
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
      });
      setSales(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, from, to, status, salesKey]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
    setRole(readRole());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === 'OWNER';
  const completed = sales.filter((s) => s.status === 'COMPLETED');
  const totalOmzet = completed.reduce((sum, sale) => sum + Number(sale.total), 0);

  async function runAction(saleId: string, action: () => Promise<void>, fallbackMessage: string) {
    setBusyId(saleId);
    setError('');
    try {
      await action();
      if (expanded === saleId) setExpanded(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(sale: Sale) {
    if (!confirm(`Batalkan transaksi ${sale.invoiceNo}? Stok akan dikembalikan.`)) return;
    await runAction(sale.id, () => api.cancelSale(token, sale.id).then(() => undefined), 'Gagal membatalkan');
  }

  async function handleRefund(sale: Sale) {
    if (!confirm(`Refund transaksi ${sale.invoiceNo}? Stok akan dikembalikan.`)) return;
    await runAction(sale.id, () => api.refundSale(token, sale.id).then(() => undefined), 'Gagal refund');
  }

  async function handleDelete(sale: Sale) {
    if (!confirm(`Hapus permanen transaksi ${sale.invoiceNo}? Data penjualan dan log stok terkait akan dihapus.`)) return;
    await runAction(sale.id, () => api.deleteSale(token, sale.id).then(() => undefined), 'Gagal menghapus transaksi');
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Penjualan</h1>
          <p className="text-sm text-slate-500">{isOwner ? 'Semua transaksi' : 'Riwayat transaksi milikmu'}</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <div><label className="mb-1 block text-xs text-slate-500">Dari</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs text-slate-500">Sampai</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
          <div className="flex items-end"><button className="btn-primary w-full" onClick={load}>Filter</button></div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card p-5"><p className="text-xs text-slate-500">Total Transaksi</p><p className="text-2xl font-bold">{sales.length}</p></div>
          <div className="card p-5"><p className="text-xs text-slate-500">Transaksi Selesai</p><p className="text-2xl font-bold text-brand-700">{completed.length}</p></div>
          <div className="card p-5"><p className="text-xs text-slate-500">Nilai Penjualan</p><p className="text-2xl font-bold">{currency(totalOmzet)}</p></div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Kasir</th>
                  <th className="px-4 py-3 text-left">Pembayaran</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const open = expanded === sale.id;
                  const canCancel = sale.status === 'COMPLETED' && (isOwner || sale.cashierId === sale.cashier?.id);
                  const isBusy = busyId === sale.id;
                  return (
                    <Fragment key={sale.id}>
                      <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setExpanded(open ? null : sale.id)}>
                        <td className="px-4 py-3 font-medium">{sale.invoiceNo}</td>
                        <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                        <td className="px-4 py-3">{sale.cashier?.name || '-'}</td>
                        <td className="px-4 py-3">{sale.paymentMethod}</td>
                        <td className="px-4 py-3 text-right font-semibold">{currency(sale.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`badge ${sale.status === 'COMPLETED' ? 'bg-brand-100 text-brand-700' : sale.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{sale.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {canCancel && (
                              <button
                                className="btn bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
                                disabled={isBusy}
                                onClick={(e) => { e.stopPropagation(); void handleCancel(sale); }}
                              >
                                {isBusy ? 'Proses...' : 'Batal'}
                              </button>
                            )}
                            {isOwner && sale.status === 'COMPLETED' && (
                              <button
                                className="btn bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                                disabled={isBusy}
                                onClick={(e) => { e.stopPropagation(); void handleRefund(sale); }}
                              >
                                {isBusy ? 'Proses...' : 'Refund'}
                              </button>
                            )}
                            {isOwner && (
                              <button
                                className="btn bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700"
                                disabled={isBusy}
                                onClick={(e) => { e.stopPropagation(); void handleDelete(sale); }}
                              >
                                {isBusy ? 'Proses...' : 'Hapus'}
                              </button>
                            )}
                            {!canCancel && !isOwner && <span className="text-xs text-slate-300">-</span>}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-8 py-4">
                            <p className="mb-2 text-xs font-semibold text-slate-500">Detail Item</p>
                            <div className="space-y-1">
                              {sale.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <span>{item.productName} <span className="text-slate-400">x {item.quantity}</span></span>
                                  <span className="font-medium">{currency(item.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
                              <span>Subtotal: <b>{currency(sale.subtotal)}</b></span>
                              <span>Diskon: <b>{currency(sale.discount)}</b></span>
                              <span>Bayar: <b>{currency(sale.paidAmount)}</b></span>
                              <span>Kembali: <b>{currency(sale.changeAmount)}</b></span>
                            </div>
                            {sale.note && <p className="mt-2 text-xs text-slate-500">Catatan: {sale.note}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {sales.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada transaksi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
