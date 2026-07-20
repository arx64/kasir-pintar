'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { readRole } from '@/hooks/use-auth';
import {
  api,
  type Category,
  type ExpenseCategory,
  type Product,
  type ProductInput,
} from '@/lib/api';
import { currency, toNumber } from '@/lib/format';

type ModalState =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; product: Product }
  | { type: 'stock'; product: Product }
  | { type: 'category' };

export default function ProdukPage() {
  const [token, setToken] = useState('');
  const [role] = useState<'OWNER' | 'KASIR'>(readRole);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [prodRes, catRes] = await Promise.all([
        api.products(token, {
          q: query || undefined,
          categoryId: filterCategory || undefined,
          lowStock: lowStockOnly || undefined,
          limit: 200,
        }),
        api.categories(token),
      ]);
      setProducts(prodRes.items);
      setCategories(catRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, query, filterCategory, lowStockOnly]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === 'OWNER';

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Produk & Stok</h1>
            <p className="text-sm text-slate-500">{isOwner ? 'Kelola barang, harga, dan stok' : 'Pantau stok barang'}</p>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <button className="btn bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setModal({ type: 'category' })}>
                + Kategori
              </button>
              <button className="btn bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setModal({ type: 'stock', product: products[0] })} disabled={!products.length}>
                Â± Adjust Stok
              </button>
              <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
                + Tambah Barang
              </button>
            </div>
          )}
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="card p-4 flex flex-col md:flex-row gap-3">
          <input
            className="input md:flex-1"
            placeholder="Cari nama atau barcode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input md:w-56" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap px-2">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            Stok menipis saja
          </label>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-left">Barcode</th>
                  <th className="px-4 py-3 text-right">Modal</th>
                  <th className="px-4 py-3 text-right">Jual</th>
                  <th className="px-4 py-3 text-center">Stok</th>
                  <th className="px-4 py-3 text-center">Min</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {isOwner && <th className="px-4 py-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const status = product.stock <= 0 ? 'Habis' : product.stock <= product.minStock ? 'Menipis' : 'Aman';
                  const statusClass = product.stock <= 0 ? 'bg-red-100 text-red-700' : product.stock <= product.minStock ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700';
                  return (
                    <tr key={product.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3">{product.category?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{product.barcode || '-'}</td>
                      <td className="px-4 py-3 text-right">{currency(product.costPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-700">{currency(product.sellPrice)}</td>
                      <td className="px-4 py-3 text-center font-semibold">{product.stock}</td>
                      <td className="px-4 py-3 text-center">{product.minStock}</td>
                      <td className="px-4 py-3 text-center"><span className={`badge ${statusClass}`}>{status}</span></td>
                      {isOwner && (
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button className="btn bg-slate-100 text-slate-700 px-2 py-1 text-xs hover:bg-slate-200" onClick={() => setModal({ type: 'stock', product })}>Stok</button>
                          <button className="btn bg-slate-100 text-slate-700 px-2 py-1 text-xs hover:bg-slate-200 ml-1" onClick={() => setModal({ type: 'edit', product })}>Edit</button>
                          <button className="btn bg-red-50 text-red-600 px-2 py-1 text-xs hover:bg-red-100 ml-1" onClick={() => handleDelete(product)}>Hapus</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr><td colSpan={isOwner ? 9 : 8} className="px-4 py-8 text-center text-slate-400">Tidak ada produk.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.type === 'add' && (
        <ProductFormModal
          categories={categories}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (body) => {
            await api.createProduct(token, body);
            setModal({ type: 'closed' });
            await load();
          }}
        />
      )}
      {modal.type === 'edit' && (
        <ProductFormModal
          product={modal.product}
          categories={categories}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (body) => {
            await api.updateProduct(token, modal.product.id, body);
            setModal({ type: 'closed' });
            await load();
          }}
        />
      )}
      {modal.type === 'stock' && (
        <StockModal
          product={modal.product}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (quantity, note) => {
            await api.adjustStock(token, modal.product.id, { quantity, note });
            setModal({ type: 'closed' });
            await load();
          }}
        />
      )}
      {modal.type === 'category' && (
        <CategoryModal
          categories={categories}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (name) => {
            await api.createCategory(token, name);
            await load();
          }}
        />
      )}
    </Shell>
  );

  async function handleDelete(product: Product) {
    if (!confirm(`Hapus "${product.name}"?\n${confirmText(product)}`)) return;
    setLoading(true);
    try {
      await api.deleteProduct(token, product.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setLoading(false);
    }
  }

  function confirmText(product: Product) {
    return true ? 'Produk yang punya riwayat penjualan akan dinonaktifkan (soft delete).' : '';
  }
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700 text-2xl leading-none" onClick={onClose}>Ã—</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductFormModal({
  product,
  categories,
  onClose,
  onSubmit,
}: {
  product?: Product;
  categories: Category[];
  onClose: () => void;
  onSubmit: (body: ProductInput) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name || '');
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [costPrice, setCostPrice] = useState(product ? String(toNumber(product.costPrice)) : '');
  const [sellPrice, setSellPrice] = useState(product ? String(toNumber(product.sellPrice)) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [minStock, setMinStock] = useState(product ? String(product.minStock) : '5');
  const [categoryId, setCategoryId] = useState(product?.categoryId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        name,
        barcode: barcode || null,
        costPrice: Number(costPrice),
        sellPrice: Number(sellPrice),
        ...(product ? {} : { stock: Number(stock) }),
        minStock: Number(minStock),
        categoryId: categoryId || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={product ? 'Edit Produk' : 'Tambah Produk'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama Produk"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Barcode (opsional)"><input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga Modal"><input className="input" type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required /></Field>
          <Field label="Harga Jual"><input className="input" type="number" min="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!product && <Field label="Stok Awal"><input className="input" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} /></Field>}
          <Field label="Minimal Stok"><input className="input" type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></Field>
        </div>
        <Field label="Kategori">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Tanpa kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn bg-slate-100 text-slate-700 flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  );
}

function StockModal({
  product,
  onClose,
  onSubmit,
}: {
  product: Product;
  onClose: () => void;
  onSubmit: (quantity: number, note?: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(Number(quantity), note || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyesuaikan stok');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Adjust Stok â€” ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p>Stok saat ini: <b>{product.stock}</b></p>
          <p>Minimal: {product.minStock}</p>
        </div>
        <Field label="Selisih Stok (positif=tambah, negatif=kurang)">
          <input className="input" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
        <Field label="Catatan (opsional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. restock dari supplier" /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn bg-slate-100 text-slate-700 flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({
  categories,
  onClose,
  onSubmit,
}: {
  categories: Category[];
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(name);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah kategori');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Kelola Kategori" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tambah Kategori Baru"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Menyimpan...' : '+ Tambah'}</button>
      </form>
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Kategori saat ini:</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="badge bg-slate-100 text-slate-700">{c.name}{c._count ? ` (${c._count.products})` : ''}</span>
          ))}
          {categories.length === 0 && <span className="text-sm text-slate-400">Belum ada kategori</span>}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}