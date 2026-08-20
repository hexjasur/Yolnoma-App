import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  User, Shield, Lock, Settings, Camera,
  Eye, EyeOff, Check, Loader2, ChevronDown, ChevronUp,
  Monitor, Package, AlertCircle, CheckCircle2, Image as ImageIcon,
  Globe, Wifi
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImageCropper from '../components/ui/ImageCropper';
import { api } from '../services/api';

// ── Helpers ──────────────────────────────────────────────────
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY as string;

async function uploadToImgBB(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const form = new FormData();
      form.append('key', IMGBB_API_KEY);
      form.append('image', base64);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);
      xhr.onload = () => {
        const res = JSON.parse(xhr.responseText);
        if (res.success) resolve(res.data.url);
        else reject(new Error('ImgBB upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    };
    reader.readAsDataURL(blob);
  });
}

function getRoleMeta(role: string) {
  switch (role) {
    case 'owner': return { label: 'Owner', color: 'from-violet-500 to-indigo-500', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20' };
    case 'admin': return { label: 'Admin', color: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' };
    default: return { label: 'User', color: 'from-blue-500 to-cyan-500', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' };
  }
}

// ── Sub-components ────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, collapsible = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111109] overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-6 py-4 ${collapsible ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default'} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
            <Icon size={15} className="text-[#D97757]" />
          </div>
          <h2 className="text-sm font-semibold text-white/80">{title}</h2>
        </div>
        {collapsible && (open ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />)}
      </button>
      {open && <div className="px-6 pb-6 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all
      ${type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300' : 'bg-red-500/15 border border-red-500/25 text-red-300'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  );
}

// ── Sessions Card ─────────────────────────────────────────────
interface Session {
  id: string;
  _id?: string;
  ip: string;
  device: string;
  user_agent?: string;
  created_at?: string;
  createdAt?: string;
  last_used_at?: string;
  isCurrent: boolean;
}

function SessionsCard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/v2/sessions');
      const list = data?.data?.sessions || data?.sessions || (Array.isArray(data) ? data : []);
      const currentSessionId = localStorage.getItem('yolnoma_session_id');
      const mapped = list.map((s: any) => ({
        ...s,
        id: s.id || s._id,
        isCurrent: s.isCurrent ?? (currentSessionId ? (s.id || s._id) === currentSessionId : false),
      }));

      let hasCurrent = mapped.some((s: any) => s.isCurrent);
      if (!hasCurrent && mapped.length > 0) {
        mapped[0].isCurrent = true;
      }
      mapped.sort((a: any, b: any) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

      setSessions(mapped);
    } catch (e: any) {
      setError(e?.message || "Sessiyalarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const terminateSession = async (id: string) => {
    setTerminatingId(id);
    try {
      await api.delete(`/api/v2/sessions/${id}`);
      setSessions(prev => prev.filter(s => (s.id || s._id) !== id));
    } catch (e: any) {
      setError(e?.message || "Sessiyani tugatishda xatolik");
    } finally {
      setTerminatingId(null);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <SectionCard title="Faol Sessiyalar" icon={Globe} collapsible>
      <div className="pt-5 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 w-full bg-white/5 animate-pulse rounded-xl border border-white/5" />
          ))
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">
            <Wifi size={24} className="mx-auto mb-2 opacity-30" />
            Faol sessiyalar topilmadi
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id || session._id}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                session.isCurrent
                  ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                  : 'bg-white/[0.03] border-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center
                  ${session.isCurrent ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 text-white/40'}`}>
                  <Monitor size={13} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/70 font-mono">{session.ip}</p>
                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        CURRENT (JORIY)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/40 truncate mt-0.5" title={session.device}>
                    {session.device}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">
                    {session.isCurrent ? 'Hozirda foydalanilmoqda' : `Faollik: ${formatDate(session.last_used_at || session.created_at || session.createdAt)}`}
                  </p>
                </div>
              </div>
              {session.isCurrent ? (
                <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                  <Check size={12} className="text-emerald-400" />
                  <span>Bu Qurilma</span>
                </div>
              ) : (
                <button
                  onClick={() => terminateSession(session.id || session._id!)}
                  disabled={terminatingId === (session.id || session._id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-red-500/10 text-red-400 border border-red-500/20
                             hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors duration-200"
                >
                  {terminatingId === (session.id || session._id) ? <Loader2 size={12} className="animate-spin" /> : 'Tugatish'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const roleMeta = getRoleMeta(user?.role ?? 'user');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [appVersion, setAppVersion] = useState('—');
  const [osInfo, setOsInfo] = useState('—');

  // Profile section
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [isPrivate, setIsPrivate] = useState(user?.is_private ?? false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Image upload states
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(user?.thumbnail_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  // Password section
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
    // Simple OS detection from user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setOsInfo('Windows');
    else if (ua.includes('mac')) setOsInfo('macOS');
    else if (ua.includes('linux')) setOsInfo('Linux');
    else setOsInfo(navigator.platform);
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Avatar upload ──────────────────────────────────────────
  const handleAvatarCropped = (blob: Blob, dataUrl: string) => {
    setAvatarBlob(blob);
    setAvatarPreview(dataUrl);
  };

  const uploadAvatar = async () => {
    if (!avatarBlob || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadToImgBB(avatarBlob);
      await api.patch('/api/v2/auth/profile', { avatarUrl: url });
      updateUser({ avatar_url: url });
      setAvatarBlob(null);
      showToast('Profil rasmi yangilandi!', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Xatolik yuz berdi', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Thumbnail upload ───────────────────────────────────────
  const handleThumbCropped = (blob: Blob, dataUrl: string) => {
    setThumbBlob(blob);
    setThumbPreview(dataUrl);
  };

  const uploadThumb = async () => {
    if (!thumbBlob || !user) return;
    setUploadingThumb(true);
    try {
      const url = await uploadToImgBB(thumbBlob);
      await api.patch('/api/v2/auth/profile', { thumbnailUrl: url });
      updateUser({ thumbnail_url: url });
      setThumbBlob(null);
      showToast('Thumbnail yangilandi!', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Xatolik yuz berdi', 'error');
    } finally {
      setUploadingThumb(false);
    }
  };

  // ── Profile save ───────────────────────────────────────────
  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      await api.patch('/api/v2/auth/profile', {
        displayName: displayName.trim() || null,
        isPrivate,
      });
      updateUser({ display_name: displayName.trim(), is_private: isPrivate });
      showToast('Profil muvaffaqiyatli saqlandi!', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Xatolik yuz berdi', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Password change ────────────────────────────────────────
  const changePassword = async () => {
    if (!user) return;
    if (newPwd !== confirmPwd) { showToast('Yangi parollar mos kelmadi', 'error'); return; }
    if (newPwd.length < 6) { showToast('Parol kamida 6 ta belgi bo\'lishi kerak', 'error'); return; }
    setPwdSaving(true);
    try {
      await api.post('/api/v2/auth/change-password', { newPassword: newPwd });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      showToast('Parol muvaffaqiyatli o\'zgartirildi!', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Parol o\'zgartirilmadi', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const strengthScore = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strength = strengthScore(newPwd);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['Zaif', 'O\'rta', 'Yaxshi', 'Zo\'r'];

  return (
    <div className="min-h-full pb-20" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* ── Thumbnail Banner ─────────────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-0" style={{ height: 250 }}>
        {thumbPreview ? (
          <img src={thumbPreview} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{
            background: `linear-gradient(135deg, #1a1614 0%, #2a1f18 50%, #1a1614 100%)`
          }}>
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 30% 40%, #D97757 0%, transparent 50%), radial-gradient(circle at 70% 60%, #7757D9 0%, transparent 50%)'
            }} />
            <ImageIcon size={40} className="text-white/10 relative z-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14110E] via-transparent to-transparent" />
      </div>

      {/* ── Profile header (avatar + name floats over banner) ── */}
      <div className="relative px-8 -mt-16 flex items-end gap-6 mb-8">
        {/* Avatar circle */}
        <div className="relative flex-shrink-0">
          <div className={`w-28 h-28 rounded-2xl border-4 border-[#14110E] overflow-hidden bg-gradient-to-br ${roleMeta.color} shadow-2xl flex items-center justify-center`}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-white/70" />
            )}
          </div>
          {/* Small edit badge */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#D97757] flex items-center justify-center shadow-lg">
            <Camera size={12} className="text-white" />
          </div>
        </div>

        {/* Name + role */}
        <div className="pb-2 flex-1">
          <h1 className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            {user?.display_name || user?.email?.split('@')[0] || 'Ism qo\'yilmagan'}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.badge}`}>
              <Shield size={10} />
              {roleMeta.label}
            </span>
            <span className="text-white/35 text-sm">{user?.email}</span>
            {isPrivate && (
              <span className="inline-flex items-center gap-1 text-xs text-white/30">
                <EyeOff size={11} /> Private
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-5">

          {/* ── Profile Info ──────────────────────────── */}
          <SectionCard title="Profil Ma'lumotlari" icon={User}>
            <div className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Instruction name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.email?.split('@')[0]}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 focus:border-[#D97757]/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Email (cannot be changed)</label>
                <input
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-white/30 cursor-not-allowed"
                />
              </div>

              {/* Private toggle */}
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <p className="text-sm font-medium text-white/80">Personal profile</p>
                  <p className="text-xs text-white/35 mt-0.5">The profile is not visible to others.</p>
                </div>
                <button
                  onClick={() => setIsPrivate(p => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isPrivate ? 'bg-[#D97757]' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save
              </button>
            </div>
          </SectionCard>

          {/* ── Password ──────────────────────────────── */}
          <SectionCard title="Parolni Yangilash" icon={Lock} collapsible>
            <div className="pt-5 space-y-4">
              {/* Old password */}
              <div className="relative">
                <label className="block text-xs font-medium text-white/40 mb-2">Old Password</label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 focus:border-[#D97757]/40 transition-all"
                  />
                  <button onClick={() => setShowOld(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 focus:border-[#D97757]/40 transition-all"
                  />
                  <button onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPwd && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength ? strengthColors[strength - 1] : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <p className={`text-xs mt-1.5 ${strength <= 1 ? 'text-red-400' : strength === 2 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {strengthLabels[strength - 1] ?? ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Confirm the new password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 transition-all
                      ${confirmPwd && newPwd !== confirmPwd ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/[0.08] focus:ring-[#D97757]/40 focus:border-[#D97757]/40'}`}
                  />
                  <button onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPwd && newPwd !== confirmPwd && (
                  <p className="text-xs text-red-400 mt-1.5">Passwords did not match.</p>
                )}
              </div>

              <button
                onClick={changePassword}
                disabled={pwdSaving || !oldPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-white/8 hover:bg-white/12 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 hover:border-white/20"
              >
                {pwdSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Reset password
              </button>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">

          {/* ── Avatar Crop ───────────────────────────── */}
          <SectionCard title="Profil rasmi (Logo)" icon={Camera}>
            <div className="pt-5 space-y-4 flex flex-col items-center">
              <ImageCropper
                aspectRatio={1}
                label="Upload a logo image (square)"
                currentUrl={user?.avatar_url ?? undefined}
                onCropped={handleAvatarCropped}
              />
              {avatarBlob && (
                <button
                  onClick={uploadAvatar}
                  disabled={uploadingAvatar}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60"
                >
                  {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Upload
                </button>
              )}
            </div>
          </SectionCard>

          {/* ── Thumbnail Crop ────────────────────────── */}
          <SectionCard title="Thumbnail (Bannyer)" icon={ImageIcon as any}>
            <div className="pt-5 space-y-4">
              <ImageCropper
                aspectRatio={16 / 5}
                label="Bannyer rasmi yuklang (keng format)"
                currentUrl={user?.thumbnail_url ?? undefined}
                onCropped={handleThumbCropped}
              />
              {thumbBlob && (
                <button
                  onClick={uploadThumb}
                  disabled={uploadingThumb}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60"
                >
                  {uploadingThumb ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Yuklash
                </button>
              )}
            </div>
          </SectionCard>

          {/* ── System Info ───────────────────────────── */}
          <SectionCard title="Tizim Ma'lumotlari" icon={Settings}>
            <div className="pt-5 space-y-3">
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">Program version</p>
                  <p className="text-sm text-white/80 font-mono mt-0.5">v{appVersion}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Monitor size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">Operatsion tizim</p>
                  <p className="text-sm text-white/80 font-mono mt-0.5 capitalize">{osInfo}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">Foydalanuvchi ID</p>
                  <p className="text-[11px] text-white/40 font-mono mt-0.5 break-all">{user?.id}</p>
                </div>
              </div>
            </div>
          </SectionCard>
          {/* ── Sessions ─────────────────────────────────── */}
          <SessionsCard />

        </div>
      </div>
    </div>
  );
}
