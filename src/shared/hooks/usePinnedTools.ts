import { useEffect, useState } from 'react';

export const PINNED_TOOLS_KEY = 'yolnoma_pinned_tools';
const PINNED_TOOLS_EVENT = 'yolnoma:pinned-tools-changed';

function readPinnedTools(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_TOOLS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writePinnedTools(ids: string[]) {
  localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(PINNED_TOOLS_EVENT));
}

export function usePinnedTools() {
  const [pinnedTools, setPinnedTools] = useState<string[]>(readPinnedTools);

  useEffect(() => {
    const sync = () => setPinnedTools(readPinnedTools());
    window.addEventListener('storage', sync);
    window.addEventListener(PINNED_TOOLS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PINNED_TOOLS_EVENT, sync);
    };
  }, []);

  const togglePinnedTool = (toolId: string) => {
    const next = pinnedTools.includes(toolId)
      ? pinnedTools.filter((id) => id !== toolId)
      : [...pinnedTools, toolId];
    writePinnedTools(next);
    setPinnedTools(next);
  };

  return { pinnedTools, togglePinnedTool };
}