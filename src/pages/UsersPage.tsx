import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Users, Shield, User as UserIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

interface UserItem {
  id: string;
  email: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: UserItem[] = await invoke('list_users');
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError(err || 'Foydalanuvchilarni yuklashda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Shield size={12} />
            Owner
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield size={12} />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
            <UserIcon size={12} />
            User
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="flex justify-between items-end mb-9 pb-7 border-b border-white/[0.06]">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-indigo-400 mb-2 font-semibold">
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

      {/* Error */}
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
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">Rol</th>
                <th className="py-4 px-6 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4 px-6 font-medium text-white/90">{u.email}</td>
                  <td className="py-4 px-6 font-mono text-xs text-white/30">{u.id}</td>
                  <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      disabled
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/40 hover:bg-white/10 border border-white/10 transition-colors opacity-50 cursor-not-allowed"
                    >
                      Tahrirlash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
