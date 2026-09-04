import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Crosshair,
  Play,
  Square,
  RotateCcw,
  Sliders,
  Palette,
  Eye,
  Check,
  ShieldCheck,
  Target,
  Sparkles,
  Maximize2,
  Copy,
  Download,
  AlertTriangle,
  Hash,
  Share2,
  BookmarkPlus,
  Trash2,
} from 'lucide-react';
import {
  CrosshairConfig,
  CrosshairType,
  DEFAULT_CROSSHAIR_CONFIG,
  PRESET_COLORS,
  CROSSHAIR_PRESETS,
  getCrosshairNumericId,
  generateCrosshairCode,
  parseCrosshairCode,
} from '../types';
import { CrosshairSVG } from '../components/CrosshairSVG';

interface CustomSavedPreset {
  id: string;
  name: string;
  code: string;
  config: CrosshairConfig;
}

export default function CrosshairPage() {
  const [config, setConfig] = useState<CrosshairConfig>(() => {
    try {
      const saved = localStorage.getItem('yolnoma_crosshair_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CROSSHAIR_CONFIG;
  });

  const [isActive, setIsActive] = useState<boolean>(false);
  const [previewBg, setPreviewBg] = useState<'dark' | 'grid' | 'cs-dust' | 'valorant'>('dark');
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [importCodeInput, setImportCodeInput] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  // Custom user saved slots
  const [savedSlots, setSavedSlots] = useState<CustomSavedPreset[]>(() => {
    try {
      const saved = localStorage.getItem('yolnoma_crosshair_user_slots');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [newSlotName, setNewSlotName] = useState<string>('');

  // Check initial active status and load saved config from Rust/Disk
  useEffect(() => {
    invoke<boolean>('is_crosshair_active')
      .then((active) => setIsActive(active))
      .catch(() => setIsActive(false));

    invoke<CrosshairConfig | null>('get_saved_crosshair_config')
      .then((saved) => {
        if (saved) {
          setConfig(saved);
        }
      })
      .catch(() => {});
  }, []);

  // Save to localStorage & Rust disk & sync with active overlay in real-time
  const updateConfig = useCallback(
    (newConfig: CrosshairConfig | ((prev: CrosshairConfig) => CrosshairConfig)) => {
      setConfig((prev) => {
        const updated = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
        localStorage.setItem('yolnoma_crosshair_config', JSON.stringify(updated));

        // Sync with Rust backend & disk
        invoke('update_crosshair_config', { config: updated }).catch((err) => {
          console.debug('Failed to sync crosshair update:', err);
        });

        return updated;
      });
    },
    []
  );

  // Toggle overlay on/off
  const handleToggleOverlay = async () => {
    try {
      if (isActive) {
        await invoke('stop_crosshair_overlay');
        setIsActive(false);
      } else {
        await invoke('start_crosshair_overlay', { config });
        setIsActive(true);
      }
    } catch (err) {
      console.error('Failed to toggle crosshair overlay:', err);
    }
  };

  // Reset to default
  const handleReset = () => {
    updateConfig(DEFAULT_CROSSHAIR_CONFIG);
  };

  // Apply preset
  const handleApplyPreset = (presetConfig: CrosshairConfig) => {
    updateConfig(presetConfig);
  };

  // Copy Crosshair ID / Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  // Import Crosshair by ID / Code
  const handleImportCode = () => {
    setImportError('');
    setImportSuccess(false);

    if (!importCodeInput.trim()) {
      setImportError('Please enter a Crosshair ID or Share Code.');
      return;
    }

    const parsed = parseCrosshairCode(importCodeInput);
    if (parsed) {
      updateConfig(parsed);
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        setImportCodeInput('');
      }, 2500);
    } else {
      setImportError('Invalid Crosshair ID or Share Code format.');
    }
  };

  // Save current setup as a custom slot
  const handleSaveCurrentSlot = () => {
    const name = newSlotName.trim() || `My Crosshair #${savedSlots.length + 1}`;
    const newSlot: CustomSavedPreset = {
      id: `slot-${Date.now()}`,
      name,
      code: generateCrosshairCode(config),
      config: { ...config },
    };
    const updated = [newSlot, ...savedSlots];
    setSavedSlots(updated);
    localStorage.setItem('yolnoma_crosshair_user_slots', JSON.stringify(updated));
    setNewSlotName('');
  };

  // Delete saved slot
  const handleDeleteSlot = (id: string) => {
    const updated = savedSlots.filter((s) => s.id !== id);
    setSavedSlots(updated);
    localStorage.setItem('yolnoma_crosshair_user_slots', JSON.stringify(updated));
  };

  const currentNumericId = getCrosshairNumericId(config);
  const currentShareCode = generateCrosshairCode(config);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--accent-glow)] border border-[var(--accent-border)] text-[var(--accent)]">
              <Crosshair size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                Crosshair Overlay
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Ultra-lightweight, hardware-accelerated, transparent click-through crosshair for games and screen utilities.
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions: Start / Stop Button & Status */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
              }`}
            />
            {isActive ? 'Active on Screen' : 'Stopped'}
          </div>

          <button
            onClick={handleToggleOverlay}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
              isActive
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                : 'bg-emerald-500 hover:bg-emerald-600 text-black font-semibold shadow-emerald-500/25'
            }`}
          >
            {isActive ? (
              <>
                <Square size={16} fill="currentColor" />
                Stop Crosshair
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                Start Crosshair
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Fullscreen Game Warning Notice ── */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5 text-amber-200/90 text-xs leading-relaxed">
        <AlertTriangle size={19} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">
            Important Note for Fullscreen Games:
          </span>{' '}
          In <strong className="text-white font-semibold">"Exclusive Fullscreen"</strong> mode, Windows may prevent external overlays from rendering properly, causing the crosshair to not appear or behave incorrectly. For 100% reliable, zero-flicker overlay rendering, please set your game's display mode to{' '}
          <strong className="text-white underline decoration-amber-400 font-semibold">
            "Borderless Fullscreen"
          </strong>{' '}
          or{' '}
          <strong className="text-white underline decoration-amber-400 font-semibold">
            "Windowed Fullscreen"
          </strong>{' '}
          in the in-game video settings.
        </div>
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Column: Live Preview & ID Management (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Live Preview Box */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-md">
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-elevated)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <Eye size={14} />
                Live Preview
              </div>

              {/* Background Theme Selector */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-[var(--border)]">
                <button
                  onClick={() => setPreviewBg('dark')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    previewBg === 'dark'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                  title="Dark background"
                >
                  Dark
                </button>
                <button
                  onClick={() => setPreviewBg('grid')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    previewBg === 'grid'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                  title="Grid background"
                >
                  Grid
                </button>
                <button
                  onClick={() => setPreviewBg('cs-dust')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    previewBg === 'cs-dust'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                  title="CS2 Dust background simulation"
                >
                  Dust
                </button>
                <button
                  onClick={() => setPreviewBg('valorant')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    previewBg === 'valorant'
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                  title="Bright sky background simulation"
                >
                  Bright
                </button>
              </div>
            </div>

            {/* Preview Viewport */}
            <div
              className={`relative h-72 w-full flex items-center justify-center select-none overflow-hidden transition-colors ${
                previewBg === 'dark'
                  ? 'bg-[#0f1115]'
                  : previewBg === 'grid'
                  ? 'bg-[#12161f] bg-[radial-gradient(#273349_1px,transparent_1px)] [background-size:16px_16px]'
                  : previewBg === 'cs-dust'
                  ? 'bg-gradient-to-tr from-[#685338] via-[#a38758] to-[#d8be8d]'
                  : 'bg-gradient-to-tr from-[#3b5998] via-[#5b7fc2] to-[#88b5ea]'
              }`}
            >
              {/* Subtle Screen Center Guidelines */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-[1px] bg-white/40" />
                <div className="h-full w-[1px] bg-white/40 absolute" />
              </div>

              {/* Dynamic SVG Crosshair */}
              <div className="relative z-10 scale-125 transition-transform">
                <CrosshairSVG config={config} size={160} />
              </div>

              {/* Coordinate Info Tag */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 border border-white/10">
                Center: X:{config.offsetX >= 0 ? `+${config.offsetX}` : config.offsetX}px, Y:
                {config.offsetY >= 0 ? `+${config.offsetY}` : config.offsetY}px
              </div>
            </div>

            {/* Bottom bar of Preview */}
            <div className="p-4 bg-[var(--bg-elevated)] border-t border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <ShieldCheck size={14} className="text-emerald-400" />
                Anti-Cheat Safe (Zero memory hooks, ban-safe)
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                Reset Defaults
              </button>
            </div>
          </div>

          {/* ── Crosshair ID & Share Code Card ── */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <Hash size={16} className="text-[var(--accent)]" />
                Digital Crosshair ID & Share Code
              </div>
            </div>

            {/* Current ID Display */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase font-semibold text-[var(--text-faint)] tracking-wider">
                  Crosshair Numeric ID
                </div>
                <div className="text-base font-mono font-bold text-[var(--accent)] mt-0.5">
                  {currentNumericId}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode(currentShareCode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    copiedId
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                  }`}
                  title="Copy complete Share Code to clipboard"
                >
                  {copiedId ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 size={13} />
                      Copy Share Code
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Import Crosshair by Code / ID */}
            <div className="space-y-2 pt-1">
              <span className="text-xs text-[var(--text-muted)]">
                Import instantly via ID or Share Code:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. YNC-eyJ... or YN-849201"
                  value={importCodeInput}
                  onChange={(e) => {
                    setImportCodeInput(e.target.value);
                    setImportError('');
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={handleImportCode}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
                >
                  <Download size={13} />
                  Import
                </button>
              </div>

              {importError && <p className="text-[11px] text-rose-400">{importError}</p>}
              {importSuccess && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Check size={12} /> Crosshair configuration applied successfully!
                </p>
              )}
            </div>

            {/* Save current slot */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <span className="text-xs text-[var(--text-muted)]">
                Save current crosshair to your library:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Profile Name (e.g. My CS2 Custom)"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={handleSaveCurrentSlot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer shrink-0"
                >
                  <BookmarkPlus size={13} />
                  Save
                </button>
              </div>

              {/* Saved Slots List */}
              {savedSlots.length > 0 && (
                <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto">
                  {savedSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs"
                    >
                      <button
                        onClick={() => updateConfig(slot.config)}
                        className="font-medium text-zinc-200 hover:text-[var(--accent)] truncate text-left flex-1"
                      >
                        {slot.name}
                      </button>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={() => handleCopyCode(slot.code)}
                          className="text-zinc-400 hover:text-white"
                          title="Copy share code"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="text-zinc-400 hover:text-rose-400"
                          title="Delete profile"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Ready Presets ── */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Sparkles size={16} className="text-[var(--accent)]" />
              Presets & Popular Setups
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {CROSSHAIR_PRESETS.map((preset) => {
                const isCurrent =
                  config.type === preset.config.type &&
                  config.color === preset.config.color &&
                  config.size === preset.config.size &&
                  config.thickness === preset.config.thickness;

                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.config)}
                    className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--accent-glow)] border-[var(--accent-border)] shadow-sm'
                        : 'bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center shrink-0">
                      <CrosshairSVG config={preset.config} size={40} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-faint)]">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {preset.description}
                      </p>
                    </div>

                    {isCurrent && <Check size={16} className="text-[var(--accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column: Customization Controls (7 Cols) ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Crosshair Type Selector */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Target size={16} className="text-[var(--accent)]" />
                Crosshair Style
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'classic' as CrosshairType, label: 'Classic Cross', desc: '4-way lines' },
                { id: 'dot' as CrosshairType, label: 'Precision Dot', desc: 'Clean pinpoint' },
                { id: 't-shape' as CrosshairType, label: 'T-Shape', desc: 'Tactical headshot' },
                { id: 'circle-dot' as CrosshairType, label: 'Circle + Dot', desc: 'Ring and spot' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => updateConfig((prev) => ({ ...prev, type: style.id }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    config.type === style.id
                      ? 'bg-[var(--accent-glow)] border-[var(--accent)] text-[var(--text-primary)] font-semibold shadow-sm'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="w-10 h-10 flex items-center justify-center">
                    <CrosshairSVG
                      config={{ ...config, type: style.id, size: 8, thickness: 2, gap: 3 }}
                      size={36}
                    />
                  </div>
                  <span className="text-xs mt-1.5 font-medium">{style.label}</span>
                  <span className="text-[10px] text-[var(--text-faint)]">{style.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Color & Visual Appearance */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Palette size={16} className="text-[var(--accent)]" />
                Color & Appearance
              </label>
            </div>

            {/* Quick Color Chips */}
            <div className="space-y-2">
              <span className="text-xs text-[var(--text-muted)]">Popular Quick Colors:</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => updateConfig((prev) => ({ ...prev, color: c.hex }))}
                    className={`group relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                      config.color.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-white ring-2 ring-[var(--accent)] scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {config.color.toLowerCase() === c.hex.toLowerCase() && (
                      <Check
                        size={14}
                        className={
                          c.hex === '#FFFFFF' || c.hex === '#FFE600' ? 'text-black' : 'text-white'
                        }
                      />
                    )}
                  </button>
                ))}

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-[var(--border)]">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => updateConfig((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    title="Choose custom color"
                  />
                  <input
                    type="text"
                    value={config.color}
                    onChange={(e) => updateConfig((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-20 px-2 py-1 text-xs font-mono rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Opacity & Outline Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Opacity Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Opacity</span>
                  <span className="font-mono font-medium text-[var(--text-primary)]">
                    {Math.round(config.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={config.opacity}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Outline Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Black Outline (High Contrast)</span>
                  <button
                    onClick={() => updateConfig((prev) => ({ ...prev, outline: !prev.outline }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      config.outline ? 'bg-[var(--accent)]' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        config.outline ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-faint)]">
                  Prevents crosshair from blending into bright skies or dark corners.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Geometry & Size Sliders */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Sliders size={16} className="text-[var(--accent)]" />
                Geometry & Sizing
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {/* Line Size / Length */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Line Length</span>
                  <span className="font-mono text-[var(--text-primary)]">{config.size}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  value={config.size}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, size: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Line Thickness */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Thickness</span>
                  <span className="font-mono text-[var(--text-primary)]">{config.thickness}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={config.thickness}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, thickness: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Center Gap */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Center Gap</span>
                  <span className="font-mono text-[var(--text-primary)]">{config.gap}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.gap}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, gap: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Center Dot Size */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">Center Dot</span>
                    <input
                      type="checkbox"
                      checked={config.dot}
                      onChange={(e) =>
                        updateConfig((prev) => ({ ...prev, dot: e.target.checked }))
                      }
                      className="accent-[var(--accent)] cursor-pointer rounded"
                    />
                  </div>
                  <span className="font-mono text-[var(--text-primary)]">{config.dotSize}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  disabled={!config.dot && config.type !== 'dot'}
                  value={config.dotSize}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, dotSize: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer disabled:opacity-40"
                />
              </div>

              {/* Ring Radius (if circle style) */}
              {(config.type === 'circle-dot' || config.showRing) && (
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Circle Radius</span>
                    <span className="font-mono text-[var(--text-primary)]">{config.ringRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="28"
                    value={config.ringRadius}
                    onChange={(e) =>
                      updateConfig((prev) => ({ ...prev, ringRadius: parseInt(e.target.value) }))
                    }
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4. Center Offset Adjustments */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Maximize2 size={16} className="text-[var(--accent)]" />
                Screen Center Position Offset
              </label>
              {(config.offsetX !== 0 || config.offsetY !== 0) && (
                <button
                  onClick={() => updateConfig((prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))}
                  className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Reset to Center (0, 0)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Horizontal (X Offset)</span>
                  <span className="font-mono text-[var(--text-primary)]">{config.offsetX}px</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={config.offsetX}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, offsetX: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Vertical (Y Offset)</span>
                  <span className="font-mono text-[var(--text-primary)]">{config.offsetY}px</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={config.offsetY}
                  onChange={(e) =>
                    updateConfig((prev) => ({ ...prev, offsetY: parseInt(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
