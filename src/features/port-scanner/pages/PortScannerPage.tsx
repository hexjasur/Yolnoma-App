import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Radar,
  Play,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Database,
  Terminal,
} from 'lucide-react';
import { Button } from '@/shared/ui';
import { toast } from '@/shared/ui/Toast';

interface PortResult {
  port: number;
  status: 'open' | 'closed' | 'timeout';
  service: string;
  latency_ms: number | null;
}

type ScanMode = 'common' | 'range' | 'custom';

const QUICK_PRESETS = [
  { label: 'Common (38 Ports)', mode: 'common' as ScanMode, icon: Globe },
  { label: 'Web (80, 443, 8080, 8443)', ports: '80, 443, 8080, 8443, 3000, 5000', icon: Globe },
  { label: 'Databases (SQL, Redis, Mongo)', ports: '3306, 5432, 6379, 27017, 1433, 1521', icon: Database },
  { label: 'Remote Access (SSH, RDP, VNC)', ports: '21, 22, 23, 3389, 5900', icon: Terminal },
];

export default function PortScannerPage() {
  const [host, setHost] = useState('127.0.0.1');
  const [scanMode, setScanMode] = useState<ScanMode>('common');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('1024');
  const [customPorts, setCustomPorts] = useState('80, 443, 3000, 5432, 8080');
  const timeoutMs = 800;
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<PortResult[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  const handleStartScan = async () => {
    const trimmedHost = host.trim();
    if (!trimmedHost) {
      toast.error('Please enter a valid target host or IP address.');
      return;
    }

    let portsToScan: number[] = [];

    if (scanMode === 'common') {
      try {
        portsToScan = await invoke<number[]>('get_common_ports');
      } catch {
        portsToScan = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3000, 3306, 3389, 5000, 5432, 6379, 8080, 27017];
      }
    } else if (scanMode === 'range') {
      const start = parseInt(rangeStart, 10);
      const end = parseInt(rangeEnd, 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start > end) {
        toast.error('Please enter a valid port range (1 - 65535).');
        return;
      }
      if (end - start > 3000) {
        toast.error('Port range is too large. Please select a range of at most 3000 ports.');
        return;
      }
      for (let p = start; p <= end; p++) {
        portsToScan.push(p);
      }
    } else {
      const parsed = customPorts
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 65535);
      portsToScan = Array.from(new Set(parsed));
      if (portsToScan.length === 0) {
        toast.error('Please enter at least one valid port number.');
        return;
      }
    }

    setIsScanning(true);
    setResults([]);

    try {
      const scanResults = await invoke<PortResult[]>('scan_ports', {
        host: trimmedHost,
        ports: portsToScan,
        timeoutMs,
      });
      setResults(scanResults);
      const openCount = scanResults.filter((r) => r.status === 'open').length;
      toast.success(`Scan completed: ${openCount} open port${openCount === 1 ? '' : 's'} found.`);
    } catch (err) {
      toast.error(String(err) || 'Port scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = (port: number) => {
    navigator.clipboard.writeText(`${host}:${port}`);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 1500);
    toast.success(`Copied ${host}:${port}`);
  };

  const filteredResults = results.filter((r) => {
    if (filterStatus === 'open' && r.status !== 'open') return false;
    if (filterStatus === 'closed' && r.status === 'open') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.port.toString().includes(q) || r.service.toLowerCase().includes(q);
    }
    return true;
  });

  const openCount = results.filter((r) => r.status === 'open').length;
  const closedCount = results.filter((r) => r.status !== 'open').length;

  return (
    <div className="min-h-full p-6 max-w-6xl mx-auto space-y-6 text-[#F2EDE6]">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <div className="flex items-center gap-2.5 text-[#D97757] mb-1.5">
          <Radar size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Network Utility</span>
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--text-primary)]">
          Port Scanner
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Scan target host or IP address for open TCP ports and active network services.
        </p>
      </div>

      {/* Target & Options Card */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 shadow-xl space-y-6">
        {/* Host Input & Mode Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          <div className="lg:col-span-5 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Target Host or IP
            </label>
            <div className="relative">
              <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1, localhost, or example.com"
                disabled={isScanning}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 focus:border-[#D97757]/50 transition-all font-mono"
              />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Scan Mode
            </label>
            <div className="flex rounded-xl bg-white/[0.03] border border-[var(--border)] p-1">
              <button
                type="button"
                onClick={() => setScanMode('common')}
                disabled={isScanning}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  scanMode === 'common'
                    ? 'bg-[#D97757] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Common
              </button>
              <button
                type="button"
                onClick={() => setScanMode('range')}
                disabled={isScanning}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  scanMode === 'range'
                    ? 'bg-[#D97757] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Range
              </button>
              <button
                type="button"
                onClick={() => setScanMode('custom')}
                disabled={isScanning}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  scanMode === 'custom'
                    ? 'bg-[#D97757] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 flex gap-3">
            <Button
              variant="primary"
              onClick={handleStartScan}
              disabled={isScanning || !host.trim()}
              className="w-full py-2.5 flex items-center justify-center gap-2 font-medium"
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scanning…</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" />
                  <span>Start Scan</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Dynamic Mode Settings */}
        {scanMode === 'range' && (
          <div className="pt-2 border-t border-white/[0.06] flex items-center gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">From Port:</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                disabled={isScanning}
                className="w-24 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-[var(--border)] text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">To Port:</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                disabled={isScanning}
                className="w-24 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-[var(--border)] text-xs font-mono"
              />
            </div>
          </div>
        )}

        {scanMode === 'custom' && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2 animate-in fade-in duration-200">
            <label className="text-xs text-[var(--text-muted)]">
              Specify ports separated by commas:
            </label>
            <input
              type="text"
              value={customPorts}
              onChange={(e) => setCustomPorts(e.target.value)}
              placeholder="e.g. 21, 22, 80, 443, 3000, 8080"
              disabled={isScanning}
              className="w-full px-3.5 py-2 rounded-lg bg-white/[0.03] border border-[var(--border)] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#D97757]"
            />
          </div>
        )}

        {/* Quick Presets */}
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] font-semibold mb-2">
            Quick Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((preset, idx) => {
              const Icon = preset.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (preset.mode) {
                      setScanMode(preset.mode);
                    } else if (preset.ports) {
                      setScanMode('custom');
                      setCustomPorts(preset.ports);
                    }
                  }}
                  disabled={isScanning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-[var(--border)] hover:bg-white/[0.06] hover:border-[#D97757]/40 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Icon size={13} className="text-[#D97757]" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header & Filters */}
      {results.length > 0 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Scan Results ({results.length} scanned)
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={12} /> {openCount} Open
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                <XCircle size={12} /> {closedCount} Closed
              </span>
            </div>

            {/* Filter Buttons & Search */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter port or service…"
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.03] border border-[var(--border)] text-xs focus:outline-none focus:ring-1 focus:ring-[#D97757]"
                />
              </div>

              <div className="flex rounded-lg bg-white/[0.03] border border-[var(--border)] p-0.5">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    filterStatus === 'all' ? 'bg-[#D97757] text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  All ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('open')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    filterStatus === 'open' ? 'bg-emerald-500 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Open ({openCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('closed')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    filterStatus === 'closed' ? 'bg-zinc-600 text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Closed ({closedCount})
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2.5 px-3">Port</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Service / Protocol</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                      No matching ports found for your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r) => {
                    const isOpen = r.status === 'open';
                    return (
                      <tr
                        key={r.port}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isOpen ? 'bg-emerald-500/[0.03]' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[var(--text-primary)]">
                          {r.port}
                        </td>
                        <td className="py-3 px-3">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              OPEN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-zinc-500/10 text-zinc-400">
                              CLOSED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-primary)] font-medium">
                          {r.service}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-muted)] font-mono">
                          {r.latency_ms !== null ? `${r.latency_ms} ms` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(r.port)}
                              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-white/[0.06] text-[var(--text-muted)] hover:text-white transition-all"
                              title="Copy Host:Port"
                            >
                              {copiedPort === r.port ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                            {isOpen && (r.port === 80 || r.port === 443 || r.port === 3000 || r.port === 8080 || r.port === 5000) && (
                              <a
                                href={`http://${host}:${r.port}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-white/[0.06] text-[#D97757] hover:text-[#D97757]/80 transition-all"
                                title="Open in browser"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
