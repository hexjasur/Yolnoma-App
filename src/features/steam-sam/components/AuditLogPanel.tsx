import { History } from 'lucide-react';

export interface AuditEntry {
  id: string;
  action: 'unlock' | 'lock' | 'stats-update' | 'stats-reset';
  gameName: string;
  appId: number;
  count?: number;
  success?: number;
  failed?: number;
  timestamp: number;
}

export function AuditLogPanel({ entries, open, onToggle }: { entries: AuditEntry[]; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 20 }}>
      <button type="button" onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 9, background: '#1B1713', border: '1px solid rgba(242,237,230,0.14)', color: 'rgba(242,237,230,0.75)', fontSize: 12, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
        <History size={14} /> Audit history ({entries.length})
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, bottom: 42, width: 340, maxHeight: 320, overflowY: 'auto', padding: 12, borderRadius: 12, background: '#1B1713', border: '1px solid rgba(242,237,230,0.14)', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#F2EDE6' }}>Recent Steam changes</p>
          {entries.length === 0 ? <p style={{ margin: 0, fontSize: 11, color: 'rgba(242,237,230,0.45)' }}>No changes recorded yet.</p> : entries.map((entry) => (
            <div key={entry.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(242,237,230,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 11, color: entry.action === 'lock' || entry.action === 'stats-reset' ? '#f87171' : '#86efac' }}>{entry.action.replace('-', ' ')}</strong>
                <span style={{ fontSize: 10, color: 'rgba(242,237,230,0.4)' }}>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(242,237,230,0.65)' }}>{entry.gameName} · App {entry.appId}</p>
              <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(242,237,230,0.4)' }}>Requested {entry.count ?? 0} · Success {entry.success ?? 0} · Failed {entry.failed ?? 0}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
