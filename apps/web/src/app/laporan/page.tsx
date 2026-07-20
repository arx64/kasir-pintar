'use client';

import { useEffect, useState } from 'react';
import { Shell, StatCard } from '@/components/shell';
import { api, type ReportResponse } from '@/lib/api';
import { currency, formatDate } from '@/lib/format';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function LaporanPage() {
  const [token, setToken] = useState('');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    api.reports(token, from, to)
      .then((data) => setReport(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat laporan'))
      .finally(() => setLoading(false));
  }, [token, from, to]);

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Laporan</h1>
            <p className="text-sm text-slate-500">Filter laporan penjualan, pengeluaran, omzet, dan profit</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn bg-slate-100 text-slate-700 text-xs hover:bg-slate-200" onClick={() => { setFrom(todayStr()); setTo(todayStr()); }}>Hari Ini</button>
            <button className="btn bg-slate-100 text-slate-700 text-xs hover:bg-slate-200" onClick={() => { setFrom(monthStartStr()); setTo(todayStr()); }}>Bulan Ini</button>
            <div><label className="block text-xs text-slate-500 mb-1">Dari</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Sampai</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading && !report && (
          <div className="card p-10 text-center text-slate-400">Memuat laporan...</div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Transaksi" value={String(report.summary.totalTransaksi)} />
              <StatCard label="Omzet" value={currency(report.summary.omzet)} tone="green" />
              <StatCard label="Pendapatan" value={currency(report.summary.pendapatan)} tone="blue" />
              <StatCard label="Pengeluaran" value={currency(report.summary.pengeluaran)} tone="red" />
              <StatCard label="Profit" value={currency(report.summary.profit)} tone={report.summary.profit >= 0 ? 'green' : 'red'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="font-bold mb-4">Produk Terlaris</h2>
                <div className="space-y-3">
                  {report.topProducts.length === 0 && <p className="text-sm text-slate-400">Belum ada penjualan di periode ini.</p>}
                  {report.topProducts.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">{index + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.qty}x</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{currency(product.omzet)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6">
                <h2 className="font-bold mb-4">Ringkasan Periode</h2>
                <div className="space-y-3">
                  <Item label="Periode" value={report.period.label} />
                  <Item label="HPP" value={currency(report.summary.cogs)} />
                  <Item label="Jumlah Penjualan" value={String(report.sales.length)} />
                  <Item label="Jumlah Pengeluaran" value={String(report.expenses.length)} />
                </div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold">Rincian Transaksi</h2>
                <span className="text-xs text-slate-500">{report.sales.length} transaksi</span>
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
                    {report.sales.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Tidak ada transaksi pada periode ini.</td></tr>
                    )}
                    {report.sales.map((sale) => (
                      <tr key={sale.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 font-medium">{sale.invoiceNo}</td>
                        <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                        <td className="px-4 py-3">{sale.cashier?.name || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{currency(sale.total)}</td>
                        <td className="px-4 py-3 min-w-48">{sale.items.map((item) => <div key={item.id} className="text-xs text-slate-600">• {item.productName} x {item.quantity}</div>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 pb-2"><span className="text-sm text-slate-500">{label}</span><span className="text-sm font-medium">{value}</span></div>;
}