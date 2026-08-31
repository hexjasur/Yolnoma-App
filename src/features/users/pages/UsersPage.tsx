import { useEffect, useState } from 'react';
import {
  Users, Shield, User as UserIcon, RefreshCw, AlertCircle, Check, Loader2,
  Edit2, Trash2, Search, X, CheckCircle2
} from 'lucide-react';
import { Button, Modal } from '@/shared/ui';

import { api } from '@/shared/api/http';
import { useAuth } from '@/features/auth/AuthContext';

interface UserItem {
  id: string;
  email: string | null;
  name?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  thumbnailUrl?: string | null;
  isPrivate?: boolean;
  role: 'owner' | 'admin' | 'user';
  createdAt?: string;
  lastSignInAt?: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'owner' | 'admin' | 'user'>('user');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/v2/users');
      const data: UserItem[] = res?.data?.users || res?.data || (Array.isArray(res) ? res : []);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Foydalanuvchilarni yuklashda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setEditDisplayName(u.displayName || u.name || '');
    setEditEmail(u.email || '');
    setEditRole(u.role || 'user');
    setEditIsPrivate(Boolean(u.isPrivate));
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setSavingEdit(false);
    setEditError(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      // Build partial update payload
      const payload: Record<string, any> = {};
      const trimmedName = editDisplayName.trim();
      if (trimmedName !== (editingUser.displayName || editingUser.name || '')) {
        payload.displayName = trimmedName || null;
      }
      if (editEmail.trim() && editEmail.trim() !== (editingUser.email || '')) {
        payload.email = editEmail.trim();
      }
      if (editIsPrivate !== Boolean(editingUser.isPrivate)) {
        payload.isPrivate = editIsPrivate;
      }
      if (currentUser?.role === 'owner' && editRole !== editingUser.role) {
        payload.role = editRole;
      }

      // If nothing changed, just close
      if (Object.keys(payload).length === 0) {
        closeEditModal();
        return;
      }

      const res = await api.patch(`/api/v2/users/${editingUser.id}`, payload);
      const updatedUser: UserItem = res?.data?.user || res?.user || {
        ...editingUser,
        ...payload,
        displayName: payload.displayName !== undefined ? payload.displayName : editingUser.displayName,
      };

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...updatedUser } : u))
      );

      setSuccessMsg(`"${updatedUser.displayName || updatedUser.email}" ma'lumotlari muvaffaqiyatli saqlandi!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      closeEditModal();
    } catch (err: any) {
      console.error(err);
      setEditError(err?.message || 'Foydalanuvchi ma\'lumotlarini saqlashda xatolik yuz berdi.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Haqiqatan ham "${userName}" foydalanuvchisini o'chirmoqchimisiz? Ushbu amalni qaytarib bo'lmaydi.`)) {
      return;
    }

    setDeletingId(userId);
    setError(null);
    try {
      await api.delete(`/api/v2/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg('Foydalanuvchi muvaffaqiyatli o\'chirildi.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Foydalanuvchini o\'chirishda xatolik yuz berdi.');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/30">
            <Shield size={12} />
            Owner
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield size={12} />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
            <UserIcon size={12} />
            User
          </span>
        );
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (u.displayName || u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    const id = u.id.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q) || id.includes(q);
  });

  const isOwner = currentUser?.role === 'owner';

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] mb-2 font-semibold">
            BOSHQARUV
          </p>
          <h1 className="font-serif text-4xl font-medium tracking-tight text-white m-0 leading-none">
            Foydalanuvchilar
          </h1>
          <p className="mt-2 text-white/40 text-sm">
            {loading ? 'Yuklanmoqda...' : `Jami ${users.length} ta ro'yxatdan o'tgan foydalanuvchi`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Foydalanuvchini qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-2 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] transition-all w-56 md:w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <Button variant="ghost" onClick={fetchUsers} disabled={loading} className="gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Yangilash
          </Button>
        </div>
      </header>

      {/* Success Banner */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Users Table / List */}
      {loading ? (
        <div className="flex-1 flex flex-col gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 w-full bg-white/5 animate-pulse rounded-xl border border-white/5"></div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 text-white/40 border border-dashed border-white/10 rounded-2xl">
          <Users className="mx-auto mb-4 text-white/20" size={40} />
          <p className="text-base text-white/80 mb-1">
            {searchQuery ? 'Qidiruv bo\'yicha foydalanuvchi topilmadi' : 'Foydalanuvchilar mavjud emas'}
          </p>
          <p className="text-xs">
            {searchQuery ? 'Boshqa so\'z orqali qidirib ko\'ring.' : 'Ma\'lumotlar bazasida hech kim mavjud emas.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#111109]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs font-semibold uppercase tracking-wider bg-white/[0.01]">
                <th className="py-4 px-6">Foydalanuvchi</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Joriy Rol</th>
                <th className="py-4 px-6 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredUsers.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isDeleting = deletingId === u.id;
                const avatar = u.avatarUrl || u.avatar;

                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={16} className="text-white/40" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">
                            {u.displayName || u.name || 'Noma\'lum'}
                            {isSelf && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                                Siz
                              </span>
                            )}
                            {u.isPrivate && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Maxfiy
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-mono text-white/30 truncate max-w-[160px]">
                            {u.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-medium text-white/80 text-sm">{u.email || '—'}</td>

                    <td className="py-4 px-6">{getRoleBadge(u.role)}</td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/80 border border-white/10 hover:border-white/25 hover:bg-white/[0.08] transition-all inline-flex items-center gap-1.5"
                          title="Tahrirlash"
                        >
                          <Edit2 size={12} className="text-[var(--accent)]" />
                          <span>Tahrirlash</span>
                        </button>

                        {/* Delete Button (Owner only, cannot delete self) */}
                        {isOwner && !isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.displayName || u.name || u.email || 'Foydalanuvchi')}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
                            title="O'chirish"
                          >
                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────────────── */}
      {editingUser && (
        <Modal
          open={Boolean(editingUser)}
          onClose={closeEditModal}
          title="Foydalanuvchini tahrirlash"
          subtitle="ADMIN BOSHQARUVI"
          maxWidth="max-w-[500px]"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" onClick={closeEditModal} disabled={savingEdit}>
                Bekor qilish
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveUser}
                disabled={savingEdit}
                className="gap-2 bg-[#D97757] hover:bg-[#c96a48]"
              >
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Saqlash
              </Button>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            {editError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                {editError}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Ko'rinadigan ism (Display Name)
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Masalan: Jane Doe"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Email manzili
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Role (Editable by Owner) */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Foydalanuvchi roli {isOwner ? '' : '(Faqat Owner o\'zgartira oladi)'}
              </label>
              <select
                value={editRole}
                disabled={!isOwner || currentUser?.id === editingUser.id}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] text-white border border-white/10 focus:border-[var(--accent)] outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="owner" className="bg-[#181410] text-white">Owner (Tizim egasi)</option>
                <option value="admin" className="bg-[#181410] text-white">Admin (Administrator)</option>
                <option value="user" className="bg-[#181410] text-white">User (Oddiy foydalanuvchi)</option>
              </select>
            </div>

            {/* Private profile toggle */}
            <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] mt-2">
              <div>
                <p className="text-xs font-medium text-white/80">Maxfiy profil (Private)</p>
                <p className="text-[11px] text-white/40">Boshqa foydalanuvchilarga profili ko'rinmaydi</p>
              </div>
              <button
                type="button"
                onClick={() => setEditIsPrivate((p) => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  editIsPrivate ? 'bg-[#D97757]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    editIsPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
