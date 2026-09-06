import type { FormEvent, RefObject } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/shared/ui';

interface ChatComposerProps {
  prompt: string;
  loading: boolean;
  promptInputRef: RefObject<HTMLTextAreaElement | null>;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export default function ChatComposer({
  prompt,
  loading,
  promptInputRef,
  onPromptChange,
  onSubmit,
}: ChatComposerProps) {
  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
  };

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-white/[0.07] bg-black/10 p-3"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 transition-colors focus-within:border-[var(--accent-border)]">
        <textarea
          ref={promptInputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onInput={(event) => resize(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey) {
              event.preventDefault();
              void onSubmit(event);
            }
          }}
          title="Press Enter to send. Press Ctrl+Enter or Shift+Enter for a new line."
          placeholder="Write a message..."
          className="form-textarea max-h-48 min-h-[46px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 shadow-none focus:border-0 focus:bg-transparent"
          rows={1}
          disabled={loading}
        />
        <Button
          type="submit"
          size="lg"
          loading={loading}
          aria-label="Send message"
          className="mt-2 w-full justify-center"
        >
          <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
            <Send size={16} /> Send
          </span>
        </Button>
      </div>
    </form>
  );
}
