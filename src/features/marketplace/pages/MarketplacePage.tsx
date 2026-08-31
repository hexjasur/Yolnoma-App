import { useEffect, useState } from 'react';
import { Download, AlertCircle, Check, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { PluginLoader, type DiscoveredPluginInfo } from '@/plugins';
import { Button } from '@/shared/ui';

interface PluginCard extends DiscoveredPluginInfo {
  installing?: boolean;
  installed?: boolean;
  error?: string;
}

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<PluginCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Discover plugins on mount
  useEffect(() => {
    const discover = async () => {
      try {
        setLoading(true);
        const discovered = await PluginLoader.discoverPlugins();
        setPlugins(
          discovered.map((p) => ({
            ...p,
            installing: false,
            installed: false,
          })),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to discover plugins',
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    discover();
  }, []);

  // Open plugins folder
  const handleOpenFolder = async () => {
    try {
      await invoke('open_plugins_folder');
    } catch (err) {
      console.error('Failed to open plugins folder:', err);
    }
  };

  // Handle install
  const handleInstall = async (plugin: PluginCard) => {
    const idx = plugins.findIndex((p) => p.dir_name === plugin.dir_name);
    if (idx === -1) return;

    try {
      const updated = [...plugins];
      updated[idx] = { ...updated[idx], installing: true, error: undefined };
      setPlugins(updated);

      await PluginLoader.loadPluginFromPath(plugin.file_path);

      updated[idx] = { ...updated[idx], installing: false, installed: true };
      setPlugins(updated);

      setTimeout(() => {
        updated[idx] = { ...updated[idx], installed: false };
        setPlugins([...updated]);
      }, 2000);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Installation failed';
      const updated = [...plugins];
      updated[idx] = { ...updated[idx], installing: false, error: errorMsg };
      setPlugins(updated);
    }
  };

  const filtered = plugins.filter((p) =>
    p.dir_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            EXTEND
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              margin: 0,
              marginBottom: 8,
              lineHeight: 1.05,
              color: 'var(--text-primary)',
            }}
          >
            Marketplace
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {loading
              ? 'Scanning…'
              : `${filtered.length} plugin${filtered.length !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Folder button */}
        <Button
          variant="ghost"
          onClick={handleOpenFolder}
          title="Open plugins folder"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <FolderOpen size={16} strokeWidth={1.5} />
          Open Folder
        </Button>
      </header>

      {/* Search */}
      <div style={{ marginBottom: 28 }}>
        <input
          type="text"
          placeholder="Search plugins…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input"
          style={{
            width: '100%',
            maxWidth: 360,
            paddingLeft: 14,
          }}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            border: '1px solid rgba(220,80,80,0.3)',
            background: 'rgba(220,80,80,0.07)',
            color: '#F2A8A8',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 28,
            fontSize: 13,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 240,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 16,
          }}
        >
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            {search ? `No matches for "${search}"` : 'No plugins found'}
          </p>
          <p style={{ fontSize: 13 }}>
            {search ? 'Try a different search.' : 'Check your plugins folder.'}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {filtered.map((plugin) => (
            <PluginCardItem
              key={plugin.dir_name}
              plugin={plugin}
              onInstall={() => handleInstall(plugin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Plugin Card ───────────────────────
interface PluginCardItemProps {
  plugin: PluginCard;
  onInstall: () => void;
}

function PluginCardItem({ plugin, onInstall }: PluginCardItemProps) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLElement).style.background =
          'rgba(217,119,87,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.background =
          'var(--bg-elevated)';
      }}
    >
      {/* Icon area */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          background: `linear-gradient(135deg, rgba(217,119,87,0.2), rgba(217,119,87,0.05))`,
          border: '1px solid rgba(217,119,87,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Download
          size={24}
          strokeWidth={1.5}
          style={{ color: 'var(--accent)' }}
        />
      </div>

      {/* Name & entry */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 4px 0',
            wordBreak: 'break-word',
          }}
        >
          {plugin.dir_name}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            margin: 0,
            fontFamily: 'monospace',
          }}
        >
          {plugin.entry_file}
        </p>
      </div>

      {/* Error message */}
      {plugin.error && (
        <div
          style={{
            fontSize: 11,
            color: '#F2A8A8',
            background: 'rgba(220,80,80,0.1)',
            padding: '8px 10px',
            borderRadius: 6,
            lineHeight: 1.4,
          }}
        >
          {plugin.error}
        </div>
      )}

      {/* Install button */}
      <Button
        variant={plugin.installed ? 'primary' : 'ghost'}
        onClick={onInstall}
        disabled={plugin.installing}
        style={{
          width: '100%',
          fontSize: 13,
          fontWeight: 600,
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {plugin.installing && (
          <span
            style={{
              opacity: 0.5,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                animation: 'spin 1s linear infinite',
              }}
            >
              ⚙️
            </span>
            Installing…
          </span>
        )}
        {plugin.installed && !plugin.installing && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Check size={14} strokeWidth={3} />
            Installed
          </span>
        )}
        {!plugin.installing && !plugin.installed && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Download size={14} strokeWidth={2} />
            Install
          </span>
        )}
      </Button>

      {/* Pulse animation on success */}
      {plugin.installed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            background: 'rgba(100,200,100,0.1)',
            pointerEvents: 'none',
            animation: 'pulse-success 0.6s ease-out',
          }}
        />
      )}

      <style>{`
        @keyframes pulse-success {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
