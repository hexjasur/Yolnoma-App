import type { PluginDefinition } from '@yolnoma/plugin-sdk';
import { PluginRegistry } from './PluginRegistry.js';
import { createPluginAPI } from './createPluginAPI.js';
import type { RuntimePlugin } from '../types/index.js';

export class PluginManager {
  private registry: PluginRegistry;

  constructor(registry?: PluginRegistry) {
    this.registry = registry || new PluginRegistry();
  }

  public getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Registers a plugin definition in the runtime registry.
   */
  public register(pluginDefinition: PluginDefinition): void {
    const { manifest } = pluginDefinition;
    if (this.registry.getPlugin(manifest.id)) {
      console.warn(`[PluginManager] Plugin "${manifest.id}" is already registered.`);
      return;
    }

    const runtimePlugin: RuntimePlugin = {
      manifest,
      definition: pluginDefinition,
      status: 'registered',
    };

    this.registry.registerPlugin(runtimePlugin);
  }

  /**
   * Activates a plugin by calling its `activate(api)` lifecycle method.
   */
  public async activate(pluginId: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`[PluginManager] Cannot activate unknown plugin: "${pluginId}"`);
    }

    if (plugin.status === 'active') {
      return;
    }

    try {
      const api = createPluginAPI(pluginId, this.registry);
      await plugin.definition.activate(api);
      plugin.status = 'active';
    } catch (err) {
      plugin.status = 'error';
      plugin.error = err instanceof Error ? err : new Error(String(err));
      console.error(`[PluginManager] Failed to activate plugin "${pluginId}":`, err);
      throw err;
    }
  }

  /**
   * Deactivates a plugin and removes its registered routes and navigation items.
   */
  public async deactivate(pluginId: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin || plugin.status !== 'active') {
      return;
    }

    try {
      if (plugin.definition.deactivate) {
        await plugin.definition.deactivate();
      }
    } catch (err) {
      console.error(`[PluginManager] Error during deactivation of plugin "${pluginId}":`, err);
    } finally {
      this.registry.removePluginResources(pluginId);
      plugin.status = 'inactive';
    }
  }
}

// Global default singleton instances for Yolnoma application
export const pluginRegistry = new PluginRegistry();
export const pluginManager = new PluginManager(pluginRegistry);
