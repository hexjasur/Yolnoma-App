import type { PluginAPI, RouteDefinition, NavigationItem } from '@yolnoma/plugin-sdk';
import type { PluginRegistry } from './PluginRegistry.js';

/**
 * Creates the PluginAPI instance passed into `plugin.activate(api)`.
 * Implements the contract defined in @yolnoma/plugin-sdk.
 */
export function createPluginAPI(pluginId: string, registry: PluginRegistry): PluginAPI {
  return {
    pluginId,
    router: {
      addRoute(route: RouteDefinition) {
        registry.addRoute(pluginId, route);
      },
    },
    navigation: {
      addItem(item: NavigationItem) {
        registry.addNavigationItem(pluginId, item);
      },
    },
  };
}
