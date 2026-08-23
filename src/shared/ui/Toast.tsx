import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type ToastPublisher = (message: string, kind: ToastKind) => void;

let publishToast: ToastPublisher | null = null;

export const toast = {
  show(message: string, kind: ToastKind = 'info') {
    publishToast?.(message, kind);
  },
  success(message: string) {
    publishToast?.(message, 'success');
  },
  error(message: string) {
    publishToast?.(message, 'error');
  },
  info(message: string) {
    publishToast?.(message, 'info');
  },
  warning(message: string) {
    publishToast?.(message, 'warning');
  },
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
} as const;

const ICON_COLOR: Record<ToastKind, string> = {
  success: '#7FBF8F',
  error: '#E08585',
  info: '#D97757',
  warning: '#E0B168',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind) => {
      const id = Date.now() + Math.floor(Math.random() * 1_000);
      setToasts((current) => [...current, { id, message, kind }].slice(-4));
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6_000 : 4_000);
    },
    [dismiss],
  );

  useEffect(() => {
    publishToast = show;
    return () => {
      if (publishToast === show) publishToast = null;
    };
  }, [show]);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[10001] flex w-[min(380px,calc(100vw-3rem))] flex-col gap-2.5"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <div
              key={item.id}
              role={item.kind === 'error' ? 'alert' : 'status'}
              // rounded-2xl
              className="toast-item pointer-events-auto flex items-start gap-3 px-4 py-3.5 relative overflow-hidden
                         border border-white/[0.10] backdrop-blur-xl"
              style={{
                background: 'rgba(24,20,16,0.55)',
                boxShadow:
                  '0 20px 45px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              {/* top glass sheen */}
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              {/* faint tinted glow, by kind */}
              <div
                className="pointer-events-none absolute -top-6 -left-6 h-20 w-20 rounded-full blur-2xl opacity-25"
                style={{ background: ICON_COLOR[item.kind] }}
              />

              <Icon
                size={17}
                strokeWidth={2}
                className="mt-0.5 shrink-0 relative z-10"
                style={{ color: ICON_COLOR[item.kind] }}
              />

              <p className="flex-1 text-sm font-medium leading-5 text-[#F2EDE6] relative z-10">
                {item.message}
              </p>

              <button
                type="button"
                aria-label="Yopish"
                className="relative z-10 rounded-md p-0.5 text-white/40 transition-colors hover:text-[#F2EDE6]"
                onClick={() => dismiss(item.id)}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .toast-item {
          animation: toast-in 180ms ease-out;
        }
      `}</style>
    </>
  );
}
