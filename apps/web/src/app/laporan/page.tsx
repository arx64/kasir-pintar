'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { api, type ReportResponse } from '@/lib/api';
import { currency, formatDate } from '@/lib/format';

export default function LaporanPage() {
  const [token, setToken] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const { data, error } = useApi<ReportResponse>(
    token ? `report?from=${from}&to=${to}` : null,
    () => api.reports(token, from || undefined, to || undefined),
    { ttl: 20_000 }
  );

  const summary = data?.summary;

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Laporan</h1>
            <p className="text-sm text-slate-500">Ringkasan penjualan, profit, dan pengeluaran.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Dari</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Sampai</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {data?.period?.label || 'Periode berjalan'}
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Stat title="Transaksi" value={summary?.totalTransaksi ?? 0} />
          <Stat title="Omzet" value={currency(summary?.omzet ?? 0)} />
          <Stat title="HPP" value={currency(summary?.cogs ?? 0)} />
          <Stat title="Pengeluaran" value={currency(summary?.pengeluaran ?? 0)} />
          <Stat title="Profit" value={currency(summary?.profit ?? 0)} accent />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Penjualan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">Kasir</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sales.map((sale) => (
                    <tr key={sale.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{sale.invoiceNo}</td>
                      <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                      <td className="px-4 py-3">{sale.cashier?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{currency(sale.total)}</td>
                      <td className="min-w-48 px-4 py-3">
                        {sale.items.map((item) => (
                          <div key={item.id} className="text-xs text-slate-600">
                            • {item.productName} x {item.quantity}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {!data?.sales.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada data penjualan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Pengeluaran</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.expenses.map((expense) => (
                    <tr key={expense.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3">{expense.category}</td>
                      <td className="px-4 py-3">{expense.description || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{currency(expense.amount)}</td>
                    </tr>
                  ))}
                  {!data?.expenses.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Belum ada data pengeluaran.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ title, value, accent = false }: { title: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
