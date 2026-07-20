'use client';

import { useEffect, useState } from 'react';
import { Shell, StatCard } from '@/components/shell';
import { api, type DashboardResponse } from '@/lib/api';
import { currency } from '@/lib/format';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';


export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const t = window.localStorage.getItem('token');
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    api.dashboard(token).then(setData).catch(console.error);
  }, [token]);

  if (!data) return <Shell allowedRoles={["OWNER"]}><div className="flex items-center justify-center min-h-[60vh] text-slate-400">Memuat dashboard...</div></Shell>;

  return (
    <Shell allowedRoles={["OWNER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan operasional gerai hari ini</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Penjualan Hari Ini" value={currency(data.today.omzet)} tone="green" />
          <StatCard label="Transaksi Hari Ini" value={String(data.today.totalTransaksi)} tone="blue" />
          <StatCard label="Profit Hari Ini" value={currency(data.today.profit)} tone={data.today.profit >= 0 ? 'green' : 'red'} />
          <StatCard label="Pengeluaran Hari Ini" value={currency(data.today.pengeluaran)} tone="red" />
          <StatCard label="Omzet Bulan Ini" value={currency(data.month.omzet)} tone="green" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-bold mb-4">Grafik 7 Hari Terakhir</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Area type="monotone" dataKey="omzet" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
                  <Area type="monotone" dataKey="pengeluaran" stroke="#ef4444" fill="#fef2f2" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-bold mb-4">Barang Terlaris</h2>
            <div className="space-y-3">
              {data.topProducts.length === 0 && <p className="text-sm text-slate-400">Belum ada data</p>}
              {data.topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.qty}x terjual</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{currency(p.omzet)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {data.lowStock.length > 0 && (
          <div className="card p-6">
            <h2 className="font-bold mb-4">Stok Hampir Habis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-red-600">Sisa {p.stock} (min: {p.minStock})</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-bold mb-4">Ringkasan Bulan Ini</h2>
            <div className="space-y-3">
              <Row label="Total Transaksi" value={String(data.month.totalTransaksi)} />
              <Row label="Omzet" value={currency(data.month.omzet)} />
              <Row label="Pendapatan" value={currency(data.month.pendapatan)} />
              <Row label="Pengeluaran" value={currency(data.month.pengeluaran)} />
              <Row label="Profit" value={currency(data.month.profit)} bold />
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-bold mb-4">Ringkasan Hari Ini</h2>
            <div className="space-y-3">
              <Row label="Total Transaksi" value={String(data.today.totalTransaksi)} />
              <Row label="Omzet" value={currency(data.today.omzet)} />
              <Row label="Pendapatan" value={currency(data.today.pendapatan)} />
              <Row label="Pengeluaran" value={currency(data.today.pengeluaran)} />
              <Row label="Profit" value={currency(data.today.profit)} bold />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-brand-700' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
