import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getVersion } from '@tauri-apps/api/app';
import { LayoutGrid, Drama, Settings, Film, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/tools/bg-remover', label: 'Background removal', icon: LayoutGrid },
  { to: '/performances', label: 'Performance', icon: Drama },
  { to: '/videos', label: 'Stream', icon: Film },
];

export default function Sidebar() {
  const [version, setVersion] = useState<string>('');
  const { logout } = useAuth();

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('0.0.0'));
  }, []);

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col">
      {/* Brand */}
      <div className="relative px-6 py-7 border-b border-[var(--border)] overflow-hidden">
        <div
          className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mb-1 relative font-semibold">
          Katalog
        </p>
        <h1 className="relative font-serif text-2xl font-medium tracking-tight text-[var(--text-primary)]">
          Performance
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 flex flex-col">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
                <Icon
                  size={17}
                  strokeWidth={1.75}
                  className={
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'
                  }
                />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <div className="flex-1" /> {/* Spacer */}

        {/* Separator */}
        <div className="h-px bg-[var(--border)] my-3 mx-2" />

        {/* Static link for Settings (can be added as a route later) */}
        <a
          href="#"
          className="group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(242,237,230,0.04)] transition-colors duration-150 cursor-not-allowed opacity-60 mb-1"
          onClick={(e) => e.preventDefault()}
        >
          <Settings
            size={17}
            strokeWidth={1.75}
            className="text-[var(--text-faint)] group-hover:text-[var(--text-muted)]"
          />
          Sozlamalar (Tez orada)
        </a>
        
        {/* Logout Button */}
        <button
          onClick={() => logout()}
          className="group relative w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
        >
          <LogOut
            size={17}
            strokeWidth={1.75}
            className="text-red-400/60 group-hover:text-red-400"
          />
          Chiqish
        </button>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-faint)] px-2 font-mono">
          {version ? `v${version} — CS` : 'Loading…'}
        </p>
      </div>
    </aside>
  );
}
