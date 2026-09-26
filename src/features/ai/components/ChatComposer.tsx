import { useRef, type FormEvent, type RefObject } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { Button } from "@/shared/ui";
import type { ChatImage } from "../types";
import { imageUrlFromText } from "../utils/imageAttachments";

interface ChatComposerProps {
  prompt: string;
  loading: boolean;
  images?: ChatImage[];
  promptInputRef: RefObject<HTMLTextAreaElement | null>;
  onPromptChange: (value: string) => void;
  onAddImages?: (files: File[]) => void;
  onAddImageUrl?: (url: string) => void;
  onRemoveImage?: (index: number) => void;
  onSubmit: (event: FormEvent) => void;
}

export default function ChatComposer({
  prompt,
  loading,
  images,
  promptInputRef,
  onPromptChange,
  onAddImages,
  onAddImageUrl,
  onRemoveImage,
  onSubmit,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachedImages = images ?? [];
  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
  };

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-white/[0.07] bg-black/10 p-3"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 transition-colors focus-within:border-[var(--accent-border)]">
        {attachedImages.length > 0 && (
          <div
            className="mb-2 flex flex-wrap gap-2 px-1"
            aria-label="Attached images"
          >
            {attachedImages.map((image, index) => (
              <div
                key={`${image.name}-${index}`}
                className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage?.(index)}
                  disabled={loading}
                  title={`Remove ${image.name}`}
                  aria-label={`Remove ${image.name}`}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/75 p-0.5 text-white hover:bg-black"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {onAddImages && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.currentTarget.files)
                onAddImages(Array.from(event.currentTarget.files));
              event.currentTarget.value = "";
            }}
          />
        )}
        <textarea
          ref={promptInputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onInput={(event) => resize(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey) {
              event.preventDefault();
              void onSubmit(event);
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.items)
              .filter((item) => item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => file !== null);
            if (files.length && onAddImages) {
              event.preventDefault();
              onAddImages(files);
              return;
            }
            const imageUrl = imageUrlFromText(
              event.clipboardData.getData("text/plain"),
            );
            if (imageUrl && onAddImageUrl) {
              event.preventDefault();
              onAddImageUrl(imageUrl);
            }
          }}
          title="Press Enter to send. Press Ctrl+Enter or Shift+Enter for a new line."
          placeholder="Write a message..."
          className="form-textarea max-h-48 min-h-[46px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 shadow-none focus:border-0 focus:bg-transparent"
          rows={1}
          disabled={loading}
        />
        <div className="mt-2 flex items-center gap-2">
          {onAddImages && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Attach image (or paste an image)"
              aria-label="Attach image"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              <ImagePlus size={17} />
            </button>
          )}
          <Button
            type="submit"
            size="lg"
            loading={loading}
            aria-label="Send message"
            className="min-w-0 flex-1 justify-center"
          >
            <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
              <Send size={16} /> Send
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}
