import { useAccountConfigStore } from '@/shared/stores/accountConfigStore';

export const PINNED_TOOLS_KEY = 'yolnoma_pinned_tools';

export function usePinnedTools() {
  const config = useAccountConfigStore((s) => s.config);
  const updateConfig = useAccountConfigStore((s) => s.updateConfig);

  const togglePinnedTool = (toolId: string) => {
    const next = config.savedTools.includes(toolId)
      ? config.savedTools.filter((id) => id !== toolId)
      : [...config.savedTools, toolId];
    void updateConfig({ savedTools: next });
  };

  const reorderPinnedTools = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const current = [...config.savedTools];
    const fromIndex = current.indexOf(sourceId);
    const toIndex = current.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [movedItem] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, movedItem);

    void updateConfig({ savedTools: current });
  };

  const movePinnedTool = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= config.savedTools.length ||
      toIndex >= config.savedTools.length
    ) {
      return;
    }

    const next = [...config.savedTools];
    const [movedTool] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, movedTool);
    void updateConfig({ savedTools: next });
  };

  return {
    pinnedTools: config.savedTools,
    togglePinnedTool,
    movePinnedTool,
    reorderPinnedTools,
  };
}
