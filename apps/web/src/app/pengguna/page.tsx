'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useApi, invalidateApi } from '@/hooks/use-api';
import { Shell } from '@/components/shell';
import { api, type User, type UserInput } from '@/lib/api';
import { formatDate } from '@/lib/format';

type ModalState =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; user: User }
  | { type: 'password'; user: User };

export default function PenggunaPage() {
  const [token, setToken] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filterRole, setFilterRole] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [error, setError] = useState('');

  const usersKey = token ? `users?role=${filterRole}&q=${query}` : null;
  const { data, error: apiError } = useApi(
    usersKey,
    () => api.users(token, { role: filterRole || undefined, q: query || undefined }),
    { ttl: 15_000 }
  );

  useEffect(() => {
    if (data) setUsers(data);
    if (apiError) setError(apiError);
  }, [data, apiError]);

  useEffect(() => {
    const t = window.localStorage.getItem('token') || '';
    setToken(t);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      invalidateApi(usersKey || '');
      const res = await api.users(token, {
        role: filterRole || undefined,
        q: query || undefined,
      });
      setUsers(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    }
  }, [token, filterRole, query, usersKey]);

  async function handleToggleActive(user: User) {
    if (!confirm(`${user.isActive ? 'Nonaktifkan' : 'Aktifkan'} akun ${user.name}?`)) return;
    try {
      await api.toggleUserActive(token, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  }

  return (
    <Shell allowedRoles={['OWNER']}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
            <p className="text-sm text-slate-500">Kelola akun owner & kasir</p>
          </div>
          <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>+ Tambah Pengguna</button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="card p-4 flex flex-col md:flex-row gap-3">
          <input
            className="input md:flex-1"
            placeholder="Cari nama atau email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input md:w-48" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Semua Role</option>
            <option value="OWNER">Owner</option>
            <option value="KASIR">Kasir</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Telepon</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Dibuat</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <Fragment key={user.id}>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${user.role === 'OWNER' ? 'bg-brand-100 text-brand-700' : 'bg-blue-100 text-blue-700'}`}>{user.role}</span>
                      </td>
                      <td className="px-4 py-3">{user.phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${user.isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>{user.isActive ? 'Aktif' : 'Nonaktif'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button className="btn bg-slate-100 text-slate-700 px-2 py-1 text-xs hover:bg-slate-200" onClick={() => setModal({ type: 'edit', user })}>Edit</button>
                        <button className="btn bg-amber-50 text-amber-700 px-2 py-1 text-xs hover:bg-amber-100 ml-1" onClick={() => setModal({ type: 'password', user })}>Password</button>
                        <button
                          className={`btn px-2 py-1 text-xs ml-1 ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada pengguna.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.type === 'add' && (
        <UserFormModal
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (body) => {
            await api.createUser(token, body as UserInput);
            setModal({ type: 'closed' });
            await load();
          }}
        />
      )}
      {modal.type === 'edit' && (
        <UserFormModal
          user={modal.user}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (body) => {
            await api.updateUser(token, modal.user.id, body);
            setModal({ type: 'closed' });
            await load();
          }}
        />
      )}
      {modal.type === 'password' && (
        <PasswordModal
          user={modal.user}
          onClose={() => setModal({ type: 'closed' })}
          onSubmit={async (password) => {
            await api.resetUserPassword(token, modal.user.id, password);
            setModal({ type: 'closed' });
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
          <button className="text-slate-400 hover:text-slate-700 text-2xl leading-none" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSubmit,
}: {
  user?: User;
  onClose: () => void;
  onSubmit: (body: Partial<UserInput>) => Promise<void>;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'KASIR'>(user?.role || 'KASIR');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body: Partial<UserInput> = {
        name,
        email,
        role,
        phone: phone || null,
        isActive,
      };
      if (!user) (body as UserInput).password = password;
      await onSubmit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={user ? 'Edit Pengguna' : 'Tambah Pengguna'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        {!user && <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>}
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'OWNER' | 'KASIR')}>
            <option value="KASIR">Kasir</option>
            <option value="OWNER">Owner</option>
          </select>
        </Field>
        <Field label="Telepon (opsional)"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="628..." /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Akun aktif
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn bg-slate-100 text-slate-700 flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({
  user,
  onClose,
  onSubmit,
}: {
  user: User;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Reset Password - ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Password Baru (min 6 karakter)"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn bg-slate-100 text-slate-700 flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Menyimpan...' : 'Reset'}</button>
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
