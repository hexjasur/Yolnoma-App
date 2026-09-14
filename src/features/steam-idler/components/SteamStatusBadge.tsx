import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function SteamStatusBadge({ running }: { running: boolean | null }) {
  const label = running === null ? 'Checking Steam…' : running ? 'Steam Running' : 'Steam Offline';
  const color = running === null ? '#facc15' : running ? '#D97757' : '#f87171';
  const background = running === null ? 'rgba(234,179,8,0.08)' : running ? 'rgba(217,119,87,0.08)' : 'rgba(239,68,68,0.08)';
  const border = running === null ? 'rgba(234,179,8,0.25)' : running ? 'rgba(217,119,87,0.25)' : 'rgba(239,68,68,0.2)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background, border: `1px solid ${border}`, borderRadius: 24, fontSize: 13, fontWeight: 500, color, backdropFilter: 'blur(8px)' }}>
      {running === null ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : running ? <Wifi size={14} /> : <WifiOff size={14} />}
      {label}
    </div>
  );
}
