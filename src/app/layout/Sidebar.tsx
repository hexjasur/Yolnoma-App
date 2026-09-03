import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getVersion } from '@tauri-apps/api/app';
import {
  LayoutGrid, Drama, Settings, Film, LogOut, Users, CircleUser,
  Gamepad2, Coins, Blocks, ShoppingCart, Gamepad, BrushCleaning
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessPage } from '@/config/roles';
import { isFeatureInDevelopment, canAccessDevFeature, handleDevFeatureClick } from '@/config/features';
import { usePluginNavigation } from '@/plugins';
import { ConfirmModal } from '@/shared/ui';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, name: 'dashboard' },

  { to: '/performances', label: 'Performance', icon: Drama, name: 'performances' },
  { to: '/videos', label: 'Stream', icon: Film, name: 'videos' },

  { to: '/tools/currency', label: 'Currency Converter', icon: Coins, name: 'currency' },
  { to: '/tools/bg-remover', label: 'Background remover', icon: LayoutGrid, name: 'bg-remover' },
  { to: '/tools/cleaner', label: 'Cleaner', icon: BrushCleaning, name: 'cleaner' },

  { to: '/tools/steam/steam-idler', label: 'Steam/Idler', icon: Gamepad2, name: 'steam-idler' },
  { to: '/tools/steam/sam', label: 'Steam/SAM', icon: Gamepad, name: 'steam-sam' },

  { to: '/users', label: 'Users', icon: Users, name: 'users' },
  { to: '/profile', label: 'Profile', icon: CircleUser, name: 'profile' },
  { to: '/settings', label: 'Settings', icon: Settings, name: 'settings' },

  { to: '/marketplace', label: 'Marketplace', icon: ShoppingCart, name: 'marketplace', inDevelopment: true }
];

export default function Sidebar() {
  const [version, setVersion] = useState<string>('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { logout, user } = useAuth();

  const pluginNavItems = usePluginNavigation();

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('0.0.0'));
  }, []);

  // Filter links based on user's role
  const filteredLinks = links.filter((link) => canAccessPage(user?.role, link.name));

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col">
      {/* Brand */}
      <div className="relative px-6 py-7 border-b border-[var(--border)] overflow-hidden">
        <div
          className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mb-1 relative font-semibold">
          Catalog
        </p>
        <h1 className="relative font-serif text-2xl font-medium tracking-tight text-[var(--text-primary)]">
          Performance
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 flex flex-col overflow-y-auto">
        {filteredLinks.map((link) => {
          const { to, label, icon: Icon } = link;
          const inDev = link.inDevelopment || isFeatureInDevelopment(link.name);
          const hasBypass = canAccessDevFeature(user?.role, link.name);

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={(e) => handleDevFeatureClick(e, link.name, user?.role)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--accent-glow)] text-[var(--text-primary)]'
                    : inDev && !hasBypass
                    ? 'text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:bg-amber-500/[0.04]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                      isActive ? 'opacity-100 bg-[var(--accent)]' : 'opacity-0'
                    }`}
                  />
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className={
                      isActive
                        ? 'text-[var(--accent)]'
                        : inDev && !hasBypass
                        ? 'text-amber-400/60 group-hover:text-amber-400'
                        : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'
                    }
                  />
                  <span className="truncate">{label}</span>
                  {inDev && (
                    <span
                      className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        hasBypass
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                      title={hasBypass ? 'In Development (Access granted for your role)' : 'In Development (Locked)'}
                    >
                      {hasBypass ? 'TEST' : 'DEV'}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Plugin Navigation Section */}
        {pluginNavItems.length > 0 && (
          <div className="pt-3">
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] font-semibold">
              Plugins
            </div>
            <div className="space-y-1 mt-1">
              {pluginNavItems.map((item) => (
                <NavLink
                  key={item.fullPath}
                  to={item.fullPath}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-[var(--accent-glow)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full transition-opacity duration-150 ${
                          isActive ? 'opacity-100 bg-[var(--accent)]' : 'opacity-0'
                        }`}
                      />
                      {item.icon && typeof item.icon !== 'string' ? (
                        item.icon
                      ) : (
                        <Blocks
                          size={17}
                          strokeWidth={1.75}
                          className={
                            isActive
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'
                          }
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" /> {/* Spacer */}

        {/* Separator */}
        <div className="h-px bg-[var(--border)] my-3 mx-2" />
        
        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="group relative w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
        >
          <LogOut
            size={17}
            strokeWidth={1.75}
            className="text-red-400/60 group-hover:text-red-400"
          />
          Sign out
        </button>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-faint)] px-2 font-mono">
          {version ? `v${version} — JK Software` : 'Loading…'}
        </p>
      </div>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await logout();
        }}
        title="Sign Out"
        description="Are you sure you want to sign out of your account? You will need to sign in again to access your workspace."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
      />
    </aside>
  );
}

