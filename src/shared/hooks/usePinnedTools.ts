import { useAccountConfigStore } from '@/shared/stores/accountConfigStore';

export const PINNED_TOOLS_KEY = 'yolnoma_pinned_tools';

export function usePinnedTools() {
  const config = useAccountConfigStore((s) => s.config);
  const updateConfig = useAccountConfigStore((s) => s.updateConfig);

  const togglePinnedTool = (toolId: string) => {
    const next = config.savedTools.includes(toolId)
      ? config.savedTools.filter((id) => id !== toolId)
      : [...config.savedTools, toolId];
    updateConfig({ savedTools: next });
  };

  return { pinnedTools: config.savedTools, togglePinnedTool };
}