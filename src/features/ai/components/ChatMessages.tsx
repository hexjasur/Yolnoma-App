import { MessageSquare, Pencil, RotateCcw } from "lucide-react";
import type { ChatMessage, OpenRouterModel } from "../types";
import MarkdownContent from "./MarkdownContent";

interface ChatMessagesProps {
  messages: ChatMessage[];
  models: OpenRouterModel[];
  loading: boolean;
  activeModel: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onEditUserMessage: (message: ChatMessage) => void;
  onRegenerateAssistantMessage: (message: ChatMessage) => void;
  regeneratingMessageId: string | null;
}

function ThinkingIndicator() {
  return (
    <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/55 shadow-sm">
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]"
            style={{ animationDelay: `${delay * 140}ms` }}
          />
        ))}
      </span>
      <span>Thinking</span>
    </div>
  );
}

export default function ChatMessages({
  messages,
  models,
  loading,
  messagesEndRef,
  onEditUserMessage,
  onRegenerateAssistantMessage,
  regeneratingMessageId,
}: ChatMessagesProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
      {!messages.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)]">
            <MessageSquare size={22} />
          </div>
          <h2 className="font-serif text-2xl text-white">
            What would you like to discuss?
          </h2>
          <p className="text-sm text-white/40">
            Save your API key and send your first message.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={
                  message.role === "user"
                    ? "group w-fit max-w-[72%] rounded-2xl bg-[var(--accent-dim)] px-3.5 py-2.5 text-sm leading-relaxed text-white [&_p]:m-0 [&_p]:break-words"
                    : "group max-w-[85%] px-1 py-2 text-sm leading-relaxed text-white/80"
                }
              >
                <MarkdownContent content={message.content} />
                {message.model && (
                  <p className="mt-2 text-[10px] text-white/30">
                    {models.find((model) => model.id === message.model)?.name ??
                      message.model}
                  </p>
                )}
                <div
                  className={`mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "user" ? (
                    <button
                      type="button"
                      title="Edit and resend"
                      aria-label="Edit and resend message"
                      onClick={() => onEditUserMessage(message)}
                      className="rounded-md p-1.5 text-white/35 hover:bg-white/[0.08] hover:text-white"
                    >
                      <Pencil size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Regenerate response"
                      aria-label="Regenerate response"
                      disabled={Boolean(regeneratingMessageId)}
                      onClick={() => onRegenerateAssistantMessage(message)}
                      className="rounded-md p-1.5 text-white/35 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                    >
                      <RotateCcw
                        size={13}
                        className={
                          regeneratingMessageId === message.id
                            ? "animate-spin"
                            : ""
                        }
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && <ThinkingIndicator />}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
