export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
};

export type OpenRouterModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

export type ModelCategory = 'all' | 'free' | 'paid';

export type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: number };
  data?: OpenRouterModel[];
};

export type ProxyResponse = {
  status: number;
  body: OpenRouterResponse;
};

export const API_KEY_STORAGE = 'yolnoma.openrouter.api-key';
export const CHAT_STORAGE = 'yolnoma.ai-chat.messages';

export const DEFAULT_MODELS: OpenRouterModel[] = [
  { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B IT' },
  { id: 'qwen/qwen3-8b', name: 'Qwen 3 8B' },
  { id: 'meta-llama/llama-3.3-8b-instruct', name: 'Llama 3.3 8B Instruct' },
];