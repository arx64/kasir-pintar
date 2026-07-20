'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { readRole } from '@/hooks/use-auth';
import { api, EXPENSE_CATEGORIES, type ExpenseCategory, type Expense } from '@/lib/api';
import { currency, formatDate } from '@/lib/format';

export default function PengeluaranPage() {
  const [token, setToken] = useState('');
  const [role] = useState<'OWNER' | 'KASIR'>(readRole);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const res = await api.expenses(token, {
        from: from || undefined,
        to: to || undefined,
        category: filterCategory || undefined,
      });
      setExpenses(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, from, to, filterCategory]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === 'OWNER';
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  async function handleDelete(expense: Expense) {
    if (!confirm(`Hapus pengeluaran "${expense.category}" sebesar ${currency(expense.amount)}?`)) return;
    try {
      await api.deleteExpense(token, expense.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Pengeluaran</h1>
            <p className="text-sm text-slate-500">Catat biaya operasional gerai (bahan, listrik, gaji, dll)</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Tambah Pengeluaran</button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="card p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="block text-xs text-slate-500 mb-1">Dari</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Sampai</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Kategori</label>
              <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Semua</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-slate-500">Total Catatan</p><p className="text-2xl font-bold">{expenses.length}</p></div>
          <div className="card p-5"><p className="text-xs text-slate-500">Total Nominal</p><p className="text-2xl font-bold text-red-600">{currency(total)}</p></div>
          <div className="card p-5"><p className="text-xs text-slate-500">Rata-rata</p><p className="text-2xl font-bold">{currency(expenses.length ? total / expenses.length : 0)}</p></div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-left">Keterangan</th>
                  <th className="px-4 py-3 text-left">Dicatat Oleh</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  {isOwner && <th className="px-4 py-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-700">{expense.category}</span></td>
                    <td className="px-4 py-3">{expense.description || '-'}</td>
                    <td className="px-4 py-3">{expense.createdBy?.name || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{currency(expense.amount)}</td>
                    {isOwner && (
                      <td className="px-4 py-3 text-center">
                        <button className="btn bg-red-50 text-red-600 px-2 py-1 text-xs hover:bg-red-100" onClick={() => handleDelete(expense)}>Hapus</button>
                      </td>
                    )}
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={isOwner ? 6 : 5} className="px-4 py-8 text-center text-slate-400">Belum ada pengeluaran. Klik "Tambah Pengeluaran" untuk mulai mencatat.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ExpenseFormModal
          onClose={() => setShowForm(false)}
          onSubmit={async (body) => {
            await api.createExpense(token, body);
            setShowForm(false);
            await load();
          }}
        />
      )}
    </Shell>
  );
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

function ExpenseFormModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (body: { date: string; category: ExpenseCategory; amount: number; description?: string }) => Promise<void> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>('OPERASIONAL');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        date: new Date(date).toISOString(),
        category,
        amount: Number(amount),
        description: description || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Tambah Pengeluaran" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tanggal"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Kategori">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Nominal (Rp)"><input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required /></Field>
        <Field label="Keterangan (opsional)"><textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. belanja bahan harian" /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn bg-slate-100 text-slate-700 flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
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