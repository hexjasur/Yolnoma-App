import { useEffect, useState } from 'react';
import { Users, Shield, User as UserIcon, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface UserItem {
  id: string;
  email: string | null;
  name: string | null;
  displayName?: string | null;
  avatar?: string | null;
  role: 'owner' | 'admin' | 'user';
  createdAt?: string;
  lastSignInAt?: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (updatingId) return;
    setUpdatingId(userId);
    setError(null);
    try {
      await api.patch(`/api/v2/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as any } : u))
      );
      setSuccessMsg('Foydalanuvchi roli yangilandi!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Rolni o\'zgartirishda xatolik yuz berdi.');
    } finally {
      setUpdatingId(null);
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

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="flex justify-between items-end mb-8 pb-6 border-b border-white/[0.06]">
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

        <Button variant="ghost" onClick={fetchUsers} disabled={loading} className="gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </Button>
      </header>

      {/* Success Banner */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3">
          <Check size={16} />
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
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-white/40 border border-dashed border-white/10 rounded-2xl">
          <Users className="mx-auto mb-4 text-white/20" size={40} />
          <p className="text-base text-white/80 mb-1">Foydalanuvchilar topilmadi</p>
          <p className="text-xs">Ma'lumotlar bazasida hech kim mavjud emas.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#111109]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs font-semibold uppercase tracking-wider bg-white/[0.01]">
                <th className="py-4 px-6">Foydalanuvchi</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Joriy Rol</th>
                <th className="py-4 px-6 text-right">Rolni o'zgartirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isUpdating = updatingId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={14} className="text-white/40" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">
                            {u.displayName || u.name || 'Noma\'lum'}
                            {isSelf && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                Siz
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-mono text-white/30 truncate max-w-[140px]">
                            {u.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-medium text-white/80 text-sm">{u.email || '—'}</td>

                    <td className="py-4 px-6">{getRoleBadge(u.role)}</td>

                    <td className="py-4 px-6 text-right">
                      {isUpdating ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)]">
                          <Loader2 size={13} className="animate-spin" />
                          Saqlanmoqda…
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/80 border border-white/10 hover:border-white/20 focus:border-[var(--accent)] outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="owner" className="bg-[#181410] text-white">Owner</option>
                          <option value="admin" className="bg-[#181410] text-white">Admin</option>
                          <option value="user" className="bg-[#181410] text-white">User</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
