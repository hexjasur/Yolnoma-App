import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { MonitorX, Minimize2, X } from 'lucide-react';

interface CloseDialogProps {
  idlingCount: number;
  onClose: () => void;
}

export default function CloseDialog({ idlingCount, onClose }: CloseDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mount bo'lishi bilan animatsiya boshlash
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleMinimize = async () => {
    setVisible(false);
    setTimeout(async () => {
      const w = getCurrentWebviewWindow();
      await w.hide();
      onClose();
    }, 200);
  };

  const handleExit = async () => {
    setVisible(false);
    setTimeout(async () => {
      await invoke('exit_app');
    }, 200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `rgba(0,0,0,${visible ? 0.6 : 0})`,
        backdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
        transition: 'background 0.2s ease, backdrop-filter 0.2s ease',
      }}
      onClick={handleMinimize}
    >
      <div
        style={{
          background: '#1B1713',
          border: '1px solid rgba(242,237,230,0.1)',
          borderRadius: 20,
          padding: '32px 28px',
          width: 360,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(217,119,87,0.12)',
              border: '1px solid rgba(217,119,87,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={18} color="#D97757" />
            </div>
            <h2 style={{
              margin: 0, fontSize: 17, fontWeight: 600,
              fontFamily: '"Inter", sans-serif',
              color: '#F2EDE6',
            }}>
              Dasturni yopish
            </h2>
          </div>

          {idlingCount > 0 ? (
            <div style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#4ade80',
                display: 'inline-block',
                boxShadow: '0 0 6px #4ade80',
                animation: 'dialogPulse 1.5s infinite',
              }} />
              <p style={{
                margin: 0, fontSize: 13, color: '#4ade80',
                fontFamily: '"Inter", sans-serif',
              }}>
                <strong>{idlingCount}</strong> ta o'yin hozir Idling qilmoqda
              </p>
            </div>
          ) : (
            <p style={{
              margin: 0, fontSize: 13,
              color: 'rgba(242,237,230,0.5)',
              fontFamily: '"Inter", sans-serif',
            }}>
              Nima qilishni tanlang:
            </p>
          )}
        </div>

        {/* Tugmalar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Minimize tugmasi */}
          <button
            onClick={handleMinimize}
            style={{
              width: '100%',
              background: 'rgba(217,119,87,0.1)',
              border: '1px solid rgba(217,119,87,0.25)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,87,0.18)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(217,119,87,0.4)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,87,0.1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(217,119,87,0.25)';
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: 'rgba(217,119,87,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Minimize2 size={18} color="#D97757" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F2EDE6', fontFamily: '"Inter", sans-serif' }}>
                Tray ga yashirish
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(242,237,230,0.45)', fontFamily: '"Inter", sans-serif' }}>
                {idlingCount > 0 ? 'Idling davom etadi' : 'Fonda ishlashda davom etadi'}
              </p>
            </div>
          </button>

          {/* Exit tugmasi */}
          <button
            onClick={handleExit}
            style={{
              width: '100%',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.18)';
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MonitorX size={18} color="#f87171" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f87171', fontFamily: '"Inter", sans-serif' }}>
                Dasturdan chiqish
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(248,113,113,0.5)', fontFamily: '"Inter", sans-serif' }}>
                {idlingCount > 0 ? 'Idling to\'xtatiladi va yopiladi' : 'Butunlay yopiladi'}
              </p>
            </div>
          </button>
        </div>

        <style>{`
          @keyframes dialogPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  );
}
