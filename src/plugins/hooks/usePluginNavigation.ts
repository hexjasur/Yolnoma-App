import { useState, useEffect } from 'react';
import { pluginRegistry } from '../runtime/PluginManager.js';
import type { ResolvedPluginNavigationItem } from '../types/index.js';

/**
 * React hook that subscribes to the PluginRegistry and returns all currently active plugin navigation items.
 */
export function usePluginNavigation(): readonly ResolvedPluginNavigationItem[] {
  const [items, setItems] = useState<readonly ResolvedPluginNavigationItem[]>(() =>
    pluginRegistry.getNavigationItems()
  );

  useEffect(() => {
    // Sync initial state
    setItems(pluginRegistry.getNavigationItems());

    // Subscribe to registry changes
    const unsubscribe = pluginRegistry.subscribe(() => {
      setItems([...pluginRegistry.getNavigationItems()]);
    });

    return unsubscribe;
  }, []);

  return items;
}
