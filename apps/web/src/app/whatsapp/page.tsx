'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';

type WaState = {
  connected: boolean;
  qr: string | null;
  qrDataUrl: string | null;
  connection: string | null;
};

export default function WhatsAppPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<WaState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const s = await api.waStatus(token);
      setStatus(s);
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
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimeout(refresh, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const connected = status?.connected;
  const connectionState = status?.connection || 'close';

  return (
    <Shell allowedRoles={["OWNER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Baileys</h1>
          <p className="text-sm text-slate-500">Scan QR untuk menghubungkan WhatsApp owner</p>
        </div>

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
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">âœ“</div>
                  <p className="font-semibold text-brand-700">WhatsApp sudah terhubung</p>
                  <p className="text-sm text-slate-500">Notifikasi & command bot aktif</p>
                </div>
              ) : status?.qrDataUrl ? (
                <div className="text-center">
                  <img src={status.qrDataUrl} alt="WhatsApp QR" className="mx-auto rounded-xl bg-white p-2" width={280} height={280} />
                  <p className="mt-4 text-sm font-medium">Scan QR ini dengan WhatsApp</p>
                  <p className="text-xs text-slate-500">QR otomatis refresh setiap 4 detik</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">â³</div>
                  <p className="font-semibold">Menunggu QR...</p>
                  <p className="text-sm text-slate-500">Klik tombol di bawah untuk mulai koneksi</p>
                </div>
              )}
            </div>

            <button className="btn-secondary w-full" onClick={reconnect} disabled={loading || connected}>
              {loading ? 'Memulai...' : connected ? 'Sudah Terhubung' : 'Mulai Koneksi / Refresh QR'}
            </button>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-bold">Cara Scan QR</h2>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">1</span><span>Buka <b>WhatsApp</b> di HP nomor owner</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">2</span><span>Menu â†’ <b>Perangkat Tertaut</b> (Linked Devices)</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">3</span><span>Tap <b>Tautkan Perangkat</b></span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">4</span><span>Arahkan kamera HP ke QR di sebelah ini</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">5</span><span>Tunggu status berubah jadi <b>Terhubung</b></span></li>
            </ol>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-medium mb-2">Perintah owner (kirim dari WhatsApp):</p>
              <div className="grid grid-cols-2 gap-1.5">
                <span>â€¢ laporan hari ini</span>
                <span>â€¢ laporan bulan ini</span>
                <span>â€¢ omzet hari ini</span>
                <span>â€¢ profit hari ini</span>
                <span>â€¢ stok</span>
                <span>â€¢ stok hampir habis</span>
                <span>â€¢ barang terlaris</span>
                <span>â€¢ pengeluaran hari ini</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-medium">Gagal connect / QR kadaluwarsa?</p>
              <p>Hapus folder <code className="rounded bg-amber-100 px-1">apps/api/wa_auth</code> lalu klik tombol koneksi ulang, atau restart API.</p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}