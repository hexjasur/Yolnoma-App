import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  User, Shield, Settings, Camera,
  EyeOff, Check, Loader2, ChevronDown, ChevronUp,
  Monitor, Package, Image as ImageIcon, CheckCircle
} from 'lucide-react';
import { useAuth, UserProfile } from '@/features/auth/AuthContext';
import ImageCropper from '@/shared/ui/ImageCropper';
import { api } from '@/shared/api/http';
import { toast } from '@/shared/ui/Toast';
import IMGBB_UPLOAD_URL from '@/shared/api/imageUploadApi';

// ── Helpers ──────────────────────────────────────────────────
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY as string;

async function uploadToImgBB(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const form = new FormData();
      if (IMGBB_API_KEY) {
        form.append('key', IMGBB_API_KEY);
      }
      form.append('image', base64);

      const xhr = new XMLHttpRequest();
      const uploadUrl = IMGBB_API_KEY
        ? `${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`
        : IMGBB_UPLOAD_URL;

      xhr.open('POST', uploadUrl);
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) resolve(res.data.url);
          else reject(new Error(res.error?.message || 'Image upload to ImgBB failed'));
        } catch {
          reject(new Error('Invalid response from image upload server'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error while uploading image'));
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
        type="button"
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

// ── Main Page ─────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const roleMeta = getRoleMeta(user?.role ?? 'user');

  const [appVersion, setAppVersion] = useState('—');
  const [osInfo, setOsInfo] = useState('—');

  // Profile section state
  const [displayName, setDisplayName] = useState(user?.displayName || user?.display_name || '');
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate ?? user?.is_private ?? false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Image upload states
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || user?.avatar_url || null);
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(user?.thumbnailUrl || user?.thumbnail_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  // Synchronize local states whenever user changes (and not currently saving)
  useEffect(() => {
    if (user && !profileSaving) {
      setDisplayName(user.displayName || user.display_name || '');
      setIsPrivate(user.isPrivate ?? user.is_private ?? false);
      if (!avatarBlob) {
        setAvatarPreview(user.avatarUrl || user.avatar_url || null);
      }
      if (!thumbBlob) {
        setThumbPreview(user.thumbnailUrl || user.thumbnail_url || null);
      }
    }
  }, [user, profileSaving]);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setOsInfo('Windows');
    else if (ua.includes('mac')) setOsInfo('macOS');
    else if (ua.includes('linux')) setOsInfo('Linux');
    else setOsInfo(navigator.platform);
  }, []);

  // ── Avatar crop & upload ───────────────────────────────────
  const handleAvatarCropped = (blob: Blob, dataUrl: string) => {
    setAvatarBlob(blob);
    setAvatarPreview(dataUrl);
  };

  const uploadAvatar = async () => {
    if (!avatarBlob || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadToImgBB(avatarBlob);
      const res = await api.patch(`/api/v2/users/${user.id}`, { avatarUrl: url });
      const rawUser = res?.data?.user || res?.data || res?.user || res;
      const updatedUser: UserProfile = {
        ...user,
        ...rawUser,
        avatarUrl: url,
        avatar_url: url,
      };
      updateUser(updatedUser);
      setAvatarBlob(null);
      setAvatarPreview(url);
      toast.success('Profile picture updated successfully!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload profile image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Thumbnail crop & upload ────────────────────────────────
  const handleThumbCropped = (blob: Blob, dataUrl: string) => {
    setThumbBlob(blob);
    setThumbPreview(dataUrl);
  };

  const uploadThumb = async () => {
    if (!thumbBlob || !user) return;
    setUploadingThumb(true);
    try {
      const url = await uploadToImgBB(thumbBlob);
      const res = await api.patch(`/api/v2/users/${user.id}`, { thumbnailUrl: url });
      const rawUser = res?.data?.user || res?.data || res?.user || res;
      const updatedUser: UserProfile = {
        ...user,
        ...rawUser,
        thumbnailUrl: url,
        thumbnail_url: url,
      };
      updateUser(updatedUser);
      setThumbBlob(null);
      setThumbPreview(url);
      toast.success('Banner image updated successfully!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload banner image');
    } finally {
      setUploadingThumb(false);
    }
  };

  // ── Profile save (handles all details + pending images) ────
  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      let finalAvatarUrl = user.avatarUrl || user.avatar_url || undefined;
      let finalThumbUrl = user.thumbnailUrl || user.thumbnail_url || undefined;

      // Upload avatar if a new image was cropped
      if (avatarBlob) {
        finalAvatarUrl = await uploadToImgBB(avatarBlob);
        setAvatarBlob(null);
        setAvatarPreview(finalAvatarUrl);
      }

      // Upload thumbnail if a new banner was cropped
      if (thumbBlob) {
        finalThumbUrl = await uploadToImgBB(thumbBlob);
        setThumbBlob(null);
        setThumbPreview(finalThumbUrl);
      }

      const payload: Record<string, any> = {
        displayName: displayName.trim() || null,
        isPrivate,
      };
      if (finalAvatarUrl !== undefined) payload.avatarUrl = finalAvatarUrl;
      if (finalThumbUrl !== undefined) payload.thumbnailUrl = finalThumbUrl;

      // Update via /api/v2/users/:id endpoint
      const res = await api.patch(`/api/v2/users/${user.id}`, payload);
      const rawUser = res?.data?.user || res?.data || res?.user || res;

      const returnedName = rawUser?.displayName || rawUser?.display_name || rawUser?.name || displayName.trim();
      const returnedAvatar = rawUser?.avatarUrl || rawUser?.avatar_url || rawUser?.avatar || finalAvatarUrl;
      const returnedThumb = rawUser?.thumbnailUrl || rawUser?.thumbnail_url || finalThumbUrl;
      const returnedPrivate = rawUser?.isPrivate ?? rawUser?.is_private ?? isPrivate;

      const updatedUser: UserProfile = {
        ...user,
        ...rawUser,
        displayName: returnedName || undefined,
        display_name: returnedName || undefined,
        avatarUrl: returnedAvatar,
        avatar_url: returnedAvatar,
        thumbnailUrl: returnedThumb,
        thumbnail_url: returnedThumb,
        isPrivate: returnedPrivate,
        is_private: returnedPrivate,
      };

      updateUser(updatedUser);
      setDisplayName(returnedName || '');
      toast.success('Profile details saved successfully!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save profile details');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="min-h-full pb-20" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* ── Thumbnail Banner ─────────────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-0" style={{ height: 250 }}>
        {thumbPreview ? (
          <img src={thumbPreview} alt="Banner" className="w-full h-full object-cover" />
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
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-white/70" />
            )}
          </div>
          {/* Small camera edit badge */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#D97757] flex items-center justify-center shadow-lg">
            <Camera size={12} className="text-white" />
          </div>
        </div>

        {/* Name + role */}
        <div className="pb-2 flex-1">
          <h1 className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            {displayName || user?.displayName || user?.display_name || user?.email?.split('@')[0] || 'Unnamed User'}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.badge}`}>
              <Shield size={10} />
              {roleMeta.label}
            </span>
            <span className="text-white/35 text-sm">{user?.email}</span>
            {isPrivate && (
              <span className="inline-flex items-center gap-1 text-xs text-white/30">
                <EyeOff size={11} /> Private Profile
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-5">

          {/* ── Profile Info ──────────────────────────── */}
          <SectionCard title="Profile Details" icon={User}>
            <div className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.email?.split('@')[0] || 'Enter display name'}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 focus:border-[#D97757]/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Email Address (Read-only)</label>
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
                  <p className="text-sm font-medium text-white/80">Private Profile</p>
                  <p className="text-xs text-white/35 mt-0.5">Your profile and activities will not be visible to other members.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(p => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isPrivate ? 'bg-[#D97757]' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                disabled={profileSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Changes
              </button>
            </div>
          </SectionCard>

          {/* ── Security / Auth Provider Info ────────── */}
          <SectionCard title="Security & Authentication" icon={Shield}>
            <div className="pt-5 space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-0.5">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90">Secured via Google OAuth</h3>
                  <p className="text-xs text-white/50 mt-1 leading-relaxed">
                    Your account is securely linked with Google. Passwords and two-factor authentication are managed directly through your Google account security settings.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400/90 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span>Active provider: Google OAuth 2.0</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">

          {/* ── Avatar Crop ───────────────────────────── */}
          <SectionCard title="Profile Picture (Logo)" icon={Camera}>
            <div className="pt-5 space-y-4 flex flex-col items-center">
              <ImageCropper
                aspectRatio={1}
                label="Upload a logo image (1:1 square)"
                currentUrl={user?.avatarUrl || user?.avatar_url || undefined}
                onCropped={handleAvatarCropped}
              />
              {avatarBlob && (
                <button
                  type="button"
                  onClick={uploadAvatar}
                  disabled={uploadingAvatar}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60"
                >
                  {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Profile Picture
                </button>
              )}
            </div>
          </SectionCard>

          {/* ── Thumbnail Crop ────────────────────────── */}
          <SectionCard title="Banner Image" icon={ImageIcon as any}>
            <div className="pt-5 space-y-4">
              <ImageCropper
                aspectRatio={16 / 5}
                label="Upload a banner image (landscape format)"
                currentUrl={user?.thumbnailUrl || user?.thumbnail_url || undefined}
                onCropped={handleThumbCropped}
              />
              {thumbBlob && (
                <button
                  type="button"
                  onClick={uploadThumb}
                  disabled={uploadingThumb}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#D97757] hover:bg-[#c96a48] text-white transition-colors disabled:opacity-60"
                >
                  {uploadingThumb ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Banner Image
                </button>
              )}
            </div>
          </SectionCard>

          {/* ── System Info ───────────────────────────── */}
          <SectionCard title="System Information" icon={Settings}>
            <div className="pt-5 space-y-3">
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">Application Version</p>
                  <p className="text-sm text-white/80 font-mono mt-0.5">v{appVersion}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Monitor size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">Operating System</p>
                  <p className="text-sm text-white/80 font-mono mt-0.5 capitalize">{osInfo}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-white/50" />
                </div>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider font-medium">User Identifier</p>
                  <p className="text-[11px] text-white/40 font-mono mt-0.5 break-all">{user?.id}</p>
                </div>
              </div>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
