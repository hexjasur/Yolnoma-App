import { useState, useEffect } from 'react';
import { pluginRegistry } from '../runtime/PluginManager.js';
import type { ResolvedPluginRoute } from '../types/index.js';

/**
 * React hook that subscribes to the PluginRegistry and returns all currently active plugin routes.
 */
export function usePluginRoutes(): readonly ResolvedPluginRoute[] {
  const [routes, setRoutes] = useState<readonly ResolvedPluginRoute[]>(() =>
    pluginRegistry.getRoutes()
  );

  useEffect(() => {
    // Sync initial state
    setRoutes(pluginRegistry.getRoutes());

    // Subscribe to registry changes
    const unsubscribe = pluginRegistry.subscribe(() => {
      setRoutes([...pluginRegistry.getRoutes()]);
    });

    return unsubscribe;
  }, []);

  return routes;
}
