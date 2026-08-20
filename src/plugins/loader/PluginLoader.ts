import { invoke } from '@tauri-apps/api/core';
import type { PluginDefinition } from '@yolnoma/plugin-sdk';
import { pluginManager } from '../runtime/PluginManager.js';
import { ensureSharedHostModules } from './sharedHostModules.js';

export interface DiscoveredPluginInfo {
  readonly dir_name: string;
  readonly entry_file: string;
  readonly file_path: string;
}

export class PluginLoader {
  /**
   * Scans AppData/Local/Yolnoma/plugins for installed external local plugins.
   */
  public static async discoverPlugins(): Promise<DiscoveredPluginInfo[]> {
    try {
      const plugins = await invoke<DiscoveredPluginInfo[]>('list_local_plugins');
      return plugins || [];
    } catch (err) {
      console.warn('[PluginLoader] Failed to scan local plugins via Tauri:', err);
      return [];
    }
  }

  /**
   * Loads a single plugin ES module from disk, resolves shared host dependencies (React, SDK),
   * and registers it with the PluginManager.
   *
   * NO eval(), NO new Function(), NO <script> injection.
   * Uses native ES Module loading via Blob URL with shared host runtime instances.
   */
  public static async loadPluginFromPath(filePath: string): Promise<PluginDefinition> {
    // 1. Read raw JavaScript source from disk
    const rawSource = await invoke<string>('read_plugin_source', { filePath });
    if (!rawSource || rawSource.trim() === '') {
      throw new Error(`Plugin file is empty: "${filePath}"`);
    }

    // 2. Ensure host React and SDK instances are exposed
    const { reactUrl, jsxRuntimeUrl, sdkUrl } = ensureSharedHostModules();

    // 3. Resolve bare module specifiers to shared host module URLs
    const resolvedSource = rawSource
      .replace(/(from\s+["'])@yolnoma\/plugin-sdk(["'])/g, `$1${sdkUrl}$2`)
      .replace(/(from\s+["'])react\/jsx-runtime(["'])/g, `$1${jsxRuntimeUrl}$2`)
      .replace(/(from\s+["'])react(["'])/g, `$1${reactUrl}$2`);

    // 4. Create ES module Blob URL
    const blob = new Blob([resolvedSource], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);

    try {
      // 5. Load native ES module dynamically
      const pluginModule = await import(/* @vite-ignore */ moduleUrl);
      const pluginDefinition = (pluginModule.default ?? pluginModule) as PluginDefinition;

      if (!pluginDefinition || !pluginDefinition.manifest?.id) {
        throw new Error(`Invalid plugin definition in "${filePath}". Missing manifest or id.`);
      }

      if (typeof pluginDefinition.activate !== 'function') {
        throw new Error(`Plugin "${pluginDefinition.manifest.id}" does not implement activate().`);
      }

      // 6. Register and activate with PluginManager
      pluginManager.register(pluginDefinition);
      await pluginManager.activate(pluginDefinition.manifest.id);

      console.log(`[PluginLoader] Successfully loaded and activated plugin: "${pluginDefinition.manifest.name}" (${pluginDefinition.manifest.id})`);
      return pluginDefinition;
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }

  /**
   * Discovers and loads all local plugins from AppData.
   */
  public static async loadAllLocalPlugins(): Promise<void> {
    const discovered = await PluginLoader.discoverPlugins();
    if (discovered.length === 0) {
      console.log('[PluginLoader] No external plugins found in AppData plugins directory.');
      return;
    }

    console.log(`[PluginLoader] Discovered ${discovered.length} external plugin(s):`, discovered.map((p) => p.dir_name));

    for (const plugin of discovered) {
      try {
        await PluginLoader.loadPluginFromPath(plugin.file_path);
      } catch (err) {
        console.error(`[PluginLoader] Error loading plugin from "${plugin.file_path}":`, err);
      }
    }
  }
}
