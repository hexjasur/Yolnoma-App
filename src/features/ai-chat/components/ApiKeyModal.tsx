import { Check, ExternalLink, KeyRound, ShieldCheck, X } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button, Input } from '@/shared/ui';

interface ApiKeyModalProps {
  draftKey: string;
  onDraftKeyChange: (value: string) => void;
  onSave: () => void;
  onDismiss: () => void;
}

export default function ApiKeyModal({
  draftKey,
  onDraftKeyChange,
  onSave,
  onDismiss,
}: ApiKeyModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#1a1511] p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[var(--accent-dim)] p-3 text-[var(--accent)]">
              <KeyRound size={22} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                YOLNOMA AI
              </p>
              <h2 className="mt-1 font-serif text-2xl text-white">
                Connect your API key
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/45">
                Add your OpenRouter key to unlock the chat. It stays on this
                device.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-2 text-white/40 hover:bg-white/[0.08] hover:text-white"
            aria-label="Close API key guide"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/65">
          <p className="font-semibold text-white">
            How to get an OpenRouter key
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed">
            <li>Open OpenRouter and create an account.</li>
            <li>
              Go to <strong className="text-white">Keys</strong> and select{' '}
              <strong className="text-white">Create Key</strong>.
            </li>
            <li>Copy the key and paste it below. Keep it private.</li>
          </ol>
          <button
            type="button"
            onClick={() => void openUrl('https://openrouter.ai/keys')}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            OpenRouter Keys <ExternalLink size={13} />
          </button>
        </div>
        <Input
          id="openrouter-key-modal"
          label="OpenRouter API key"
          type="password"
          value={draftKey}
          onChange={(event) => onDraftKeyChange(event.target.value)}
          placeholder="sk-or-v1-..."
          autoComplete="off"
          autoFocus
        />
        <div className="mt-5 grid grid-cols-[1fr,auto] items-center gap-3">
          <span className="flex items-center gap-2 text-[11px] text-white/35">
            <ShieldCheck size={14} /> Stored locally
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Later
            </Button>
            <Button type="submit">
              <Check size={16} /> Save and continue
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
