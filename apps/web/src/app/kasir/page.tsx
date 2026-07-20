'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, type Product, type Sale } from '@/lib/api';
import { currency, toNumber } from '@/lib/format';

type CartItem = {
  productId: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
};

type GeneratedQris = {
  amount: number;
  qrisString: string;
  qrImageDataUrl: string;
  expiresAt: string;
};

export default function KasirPage() {
  const [token, setToken] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [paidAmount, setPaidAmount] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Sale | null>(null);
  const [qris, setQris] = useState<GeneratedQris | null>(null);
  const [qrisLoading, setQrisLoading] = useState(false);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    api.products(token)
      .then((res) => setProducts(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat produk'));
  }, [token]);

  const filteredProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products;
    return products.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(q);
      const barcodeMatch = product.barcode?.toLowerCase().includes(q);
      return nameMatch || barcodeMatch;
    });
  }, [products, query]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const total = Math.max(subtotal - Number(discount || 0), 0);
  const paid = Number(paidAmount || 0);
  const change = Math.max(paid - total, 0);

  useEffect(() => {
    setQris(null);
  }, [total, discount, cart.length]);

  function addToCart(product: Product) {
    const price = toNumber(product.sellPrice);
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id);
      if (found) {
        return current.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, item.stock),
              }
            : item
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price,
          stock: product.stock,
          quantity: product.stock > 0 ? 1 : 0,
        },
      ].filter((item) => item.quantity > 0);
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = Math.max(0, Math.min(item.quantity + delta, item.stock));
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  async function generateQris() {
    if (!token) return;
    if (!cart.length) {
      setError('Keranjang masih kosong');
      return;
    }
    if (total <= 0) {
      setError('Total transaksi harus lebih dari 0');
      return;
    }
    setQrisLoading(true);
    setError('');
    try {
      const generated = await api.generateQris(token, { amount: total });
      setQris(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat QRIS dinamis');
    } finally {
      setQrisLoading(false);
    }
  }

  async function submitSale() {
    if (!token) return;
    if (!cart.length) {
      setError('Keranjang masih kosong');
      return;
    }
    if (paymentMethod === 'CASH' && paid < total) {
      setError('Nominal bayar kurang dari total');
      return;
    }
    if (paymentMethod === 'QRIS' && !qris) {
      setError('Generate QRIS dinamis dulu sebelum menyelesaikan transaksi');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const sale = await api.createSale(token, {
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        paidAmount: paymentMethod === 'QRIS' ? total : paid,
        discount: Number(discount || 0),
        note: paymentMethod === 'QRIS'
          ? [note, qris ? `QRIS Dinamis: ${qris.qrisString}` : ''].filter(Boolean).join(' | ')
          : note || undefined,
      });
      setSuccess(sale);
      setCart([]);
      setPaidAmount('0');
      setDiscount('0');
      setNote('');
      setQris(null);
      const refreshed = await api.products(token);
      setProducts(refreshed.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaksi gagal');
    } finally {
      setLoading(false);
    }
  }

  function printReceipt() {
    if (!success) return;
    const receipt = [
      'KASIR PINTAR',
      `Invoice: ${success.invoiceNo}`,
      `Tanggal: ${new Date(success.createdAt).toLocaleString('id-ID')}`,
      '-------------------------------',
      ...success.items.map(
        (item) =>
          `${item.productName}\n${item.quantity} x ${currency(item.unitPrice)} = ${currency(item.subtotal)}`
      ),
      '-------------------------------',
      `Subtotal : ${currency(success.subtotal)}`,
      `Diskon   : ${currency(success.discount)}`,
      `Total    : ${currency(success.total)}`,
      `Bayar    : ${currency(success.paidAmount)}`,
      `Kembali  : ${currency(success.changeAmount)}`,
      `Metode   : ${success.paymentMethod}`,
      '',
      'Terima kasih 🙏',
    ].join('\n');

    const win = window.open('', '_blank', 'width=360,height=640');
    if (!win) return;
    win.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${receipt}</pre>`);
    win.document.close();
    win.print();
  }

  async function copyQrisPayload() {
    if (!qris) return;
    await navigator.clipboard.writeText(qris.qrisString);
    alert('Payload QRIS dinamis berhasil disalin');
  }

  return (
    <Shell allowedRoles={['KASIR']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Kasir POS</h1>
          <p className="text-sm text-slate-500">Transaksi cepat dengan cash atau QRIS dinamis</p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Transaksi berhasil</p>
              <p>{success.invoiceNo} • {currency(success.total)}</p>
            </div>
            <button className="btn-secondary" onClick={printReceipt}>Cetak Struk</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 card p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="font-bold">Daftar Barang</h2>
              <input
                className="input md:max-w-sm"
                placeholder="Cari nama atau barcode..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const out = product.stock <= 0;
                const low = product.stock > 0 && product.stock <= product.minStock;
                return (
                  <div key={product.id} className="rounded-2xl border border-slate-200 p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{product.name}</h3>
                        <p className="text-sm text-slate-500">{product.category?.name || 'Tanpa kategori'}</p>
                        {product.barcode && <p className="text-xs text-slate-400">Barcode: {product.barcode}</p>}
                      </div>
                      <span className={`badge ${out ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'}`}>
                        Stok {product.stock}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Harga jual</p>
                        <p className="text-lg font-bold text-brand-700">{currency(product.sellPrice)}</p>
                      </div>
                      <button
                        className={`btn ${out ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        onClick={() => addToCart(product)}
                        disabled={out}
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5 h-fit sticky top-6">
            <h2 className="font-bold mb-4">Keranjang</h2>
            <div className="space-y-3 max-h-[32vh] overflow-y-auto pr-1">
              {cart.length === 0 && <p className="text-sm text-slate-400">Belum ada item dipilih.</p>}
              {cart.map((item) => (
                <div key={item.productId} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">{currency(item.price)} / item</p>
                    </div>
                    <p className="text-sm font-bold">{currency(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="btn bg-slate-100 text-slate-700 px-3 py-2" onClick={() => changeQty(item.productId, -1)}>-</button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button className="btn bg-slate-100 text-slate-700 px-3 py-2" onClick={() => changeQty(item.productId, 1)}>+</button>
                    </div>
                    <span className="text-xs text-slate-400">stok {item.stock}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Metode Pembayaran</label>
                <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'QRIS')}>
                  <option value="CASH">Cash</option>
                  <option value="QRIS">QRIS Dinamis</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Diskon</label>
                <input className="input" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nominal Bayar</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={paymentMethod === 'QRIS' ? String(total) : paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  disabled={paymentMethod === 'QRIS'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catatan</label>
                <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
              </div>
            </div>

            {paymentMethod === 'QRIS' && (
              <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-800">QRIS Dinamis</p>
                    <p className="text-xs text-brand-700">Nominal otomatis sesuai total transaksi</p>
                  </div>
                  <button className="btn bg-brand-600 text-white hover:bg-brand-700 px-3 py-2 text-sm" onClick={generateQris} disabled={qrisLoading || total <= 0}>
                    {qrisLoading ? 'Membuat...' : qris ? 'Refresh QRIS' : 'Buat QRIS'}
                  </button>
                </div>

                {qris && (
                  <>
                    <div className="rounded-xl bg-white p-3 border border-brand-100 flex justify-center">
                      <img src={qris.qrImageDataUrl} alt="QRIS Dinamis" className="rounded-lg" width={240} height={240} />
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p>Nominal: <span className="font-semibold text-slate-800">{currency(qris.amount)}</span></p>
                      <p>Berlaku sampai: <span className="font-semibold text-slate-800">{new Date(qris.expiresAt).toLocaleTimeString('id-ID')}</span></p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-xs font-medium mb-1">Payload QRIS Dinamis</p>
                      <p className="text-[10px] break-all text-slate-500">{qris.qrisString}</p>
                      <button className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 mt-2 px-3 py-2 text-xs" onClick={copyQrisPayload}>Copy Payload</button>
                    </div>
                    <p className="text-[11px] text-slate-500">Setelah customer membayar, klik "Selesaikan Transaksi" untuk mencatat transaksi QRIS.</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 space-y-2">
              <SummaryRow label="Subtotal" value={currency(subtotal)} />
              <SummaryRow label="Diskon" value={currency(discount)} />
              <SummaryRow label="Total" value={currency(total)} strong />
              <SummaryRow label="Bayar" value={currency(paymentMethod === 'QRIS' ? total : paid)} />
              <SummaryRow label="Kembalian" value={currency(change)} />
            </div>

            <button className="btn-primary w-full mt-4" onClick={submitSale} disabled={loading || cart.length === 0 || (paymentMethod === 'QRIS' && !qris)}>
              {loading ? 'Memproses transaksi...' : paymentMethod === 'QRIS' ? 'Selesaikan Transaksi QRIS' : 'Selesaikan Transaksi'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-lg text-brand-700' : 'font-medium'}>{value}</span>
    </div>
  );
}