'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, type WhatsAppLog } from '@/lib/api';
import { formatDate } from '@/lib/format';

type WaState = {
  connected: boolean;
  qr: string | null;
  qrDataUrl: string | null;
  connection: string | null;
};

export default function WhatsAppPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<WaState | null>(null);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [tab, setTab] = useState<'qr' | 'logs'>('qr');

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [s, l] = await Promise.all([
        api.waStatus(token),
        api.waLogs(token, 30).catch(() => []),
      ]);
      setStatus(s);
      setLogs(l);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function reconnect() {
    if (!token) return;
    setLoading(true);
    try {
      await api.waConnect(token);
      setTimeout(refresh, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    if (!token || !testTo || !testMsg) return;
    setLoading(true);
    try {
      await api.waTest(token, testTo, testMsg);
      setTestTo('');
      setTestMsg('');
      setTimeout(refresh, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const connected = status?.connected;
  const connectionState = status?.connection || 'close';

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Baileys</h1>
          <p className="text-sm text-slate-500">Scan QR untuk menghubungkan WhatsApp owner</p>
        </div>

        <div className="flex gap-2">
          <button className={`btn px-4 py-2 text-sm ${tab === 'qr' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => setTab('qr')}>
            Koneksi &amp; QR
          </button>
          <button className={`btn px-4 py-2 text-sm ${tab === 'logs' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => setTab('logs')}>
            Riwayat Log
          </button>
        </div>

        {tab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Status Koneksi</h2>
                <span className={`badge ${connected ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'}`}>
                  {connected ? 'Terhubung' : connectionState === 'close' ? 'Terputus' : connectionState}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 min-h-72">
                {connected ? (
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">&#10003;</div>
                    <p className="font-semibold text-brand-700">WhatsApp sudah terhubung</p>
                    <p className="text-sm text-slate-500">Notifikasi &amp; command bot aktif</p>
                  </div>
                ) : status?.qrDataUrl ? (
                  <div className="text-center">
                    <img src={status.qrDataUrl} alt="WhatsApp QR" className="mx-auto rounded-xl bg-white p-2" width={280} height={280} />
                    <p className="mt-4 text-sm font-medium">Scan QR ini dengan WhatsApp</p>
                    <p className="text-xs text-slate-500">QR otomatis refresh setiap 4 detik</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">&#9203;</div>
                    <p className="font-semibold">Menunggu QR...</p>
                    <p className="text-sm text-slate-500">Klik tombol di bawah untuk mulai koneksi</p>
                  </div>
                )}
              </div>

              <button className="btn-secondary w-full" onClick={reconnect} disabled={loading || connected}>
                {loading ? 'Memulai...' : connected ? 'Sudah Terhubung' : 'Mulai Koneksi / Refresh QR'}
              </button>

              {connected && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="font-semibold text-sm">Kirim Pesan Uji</h3>
                  <input className="input" placeholder="6281234567890" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <textarea className="input min-h-16" placeholder="Isi pesan..." value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
                  <button className="btn-primary w-full" onClick={sendTest} disabled={loading || !testTo || !testMsg}>
                    Kirim
                  </button>
                </div>
              )}
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="font-bold">Cara Scan QR</h2>
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">1</span><span>Buka <b>WhatsApp</b> di HP nomor owner</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">2</span><span>Menu &rarr; <b>Perangkat Tertaut</b> (Linked Devices)</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">3</span><span>Tap <b>Tautkan Perangkat</b></span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">4</span><span>Arahkan kamera HP ke QR di sebelah ini</span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">5</span><span>Tunggu status berubah jadi <b>Terhubung</b></span></li>
              </ol>

              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-medium mb-2">Perintah owner (kirim dari WhatsApp):</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span>&bull; laporan hari ini</span>
                  <span>&bull; laporan bulan ini</span>
                  <span>&bull; omzet hari ini</span>
                  <span>&bull; profit hari ini</span>
                  <span>&bull; stok</span>
                  <span>&bull; stok hampir habis</span>
                  <span>&bull; barang terlaris</span>
                  <span>&bull; pengeluaran hari ini</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                <p className="font-medium">Gagal connect / QR kadaluwarsa?</p>
                <p>Hapus folder <code className="rounded bg-amber-100 px-1">apps/api/wa_auth</code> lalu klik tombol koneksi ulang, atau restart API.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-bold">Riwayat WhatsApp ({logs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">Tipe</th>
                    <th className="px-4 py-3 text-left">Tujuan</th>
                    <th className="px-4 py-3 text-left">Pesan</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-700">{log.type}</span></td>
                      <td className="px-4 py-3 text-xs">{log.to || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-md truncate">{log.message}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${log.status === 'SENT' ? 'bg-brand-100 text-brand-700' : log.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{log.status}</span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada log.</td></tr>
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
