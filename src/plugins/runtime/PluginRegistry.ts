import type { RouteDefinition, NavigationItem } from '@yolnoma/plugin-sdk';
import type { RuntimePlugin, ResolvedPluginRoute, ResolvedPluginNavigationItem } from '../types/index.js';

/**
 * Registry storing all loaded plugins, active routes, and active navigation items.
 * Supports reactive subscriptions so React components update when plugins are activated/deactivated.
 */
export class PluginRegistry {
  private plugins = new Map<string, RuntimePlugin>();
  private routes: ResolvedPluginRoute[] = [];
  private navigationItems: ResolvedPluginNavigationItem[] = [];
  private listeners = new Set<() => void>();

  /**
   * Helper to normalize namespaced route paths:
   * e.g. pluginId="com.jksoftware.json-validator", relativePath="/" -> "/plugin/com.jksoftware.json-validator"
   * e.g. pluginId="com.jksoftware.json-validator", relativePath="/settings" -> "/plugin/com.jksoftware.json-validator/settings"
   */
  public static resolvePluginPath(pluginId: string, relativePath: string): string {
    const cleanRel = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    if (cleanRel === '/') {
      return `/plugin/${pluginId}`;
    }
    return `/plugin/${pluginId}${cleanRel}`;
  }

  public registerPlugin(plugin: RuntimePlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
    this.notify();
  }

  public getPlugin(pluginId: string): RuntimePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  public getAllPlugins(): RuntimePlugin[] {
    return Array.from(this.plugins.values());
  }

  public addRoute(pluginId: string, route: RouteDefinition): void {
    const fullPath = PluginRegistry.resolvePluginPath(pluginId, route.path);
    // Prevent duplicate route paths
    if (this.routes.some((r) => r.fullPath === fullPath)) {
      console.warn(`[PluginRegistry] Route "${fullPath}" already registered for plugin "${pluginId}".`);
      return;
    }

    this.routes.push({
      pluginId,
      relativePath: route.path,
      fullPath,
      component: route.component,
      meta: route.meta,
    });
    this.notify();
  }

  public addNavigationItem(pluginId: string, item: NavigationItem): void {
    const resolved = this.resolveNavigationItem(pluginId, item);
    this.navigationItems.push(resolved);
    this.notify();
  }

  private resolveNavigationItem(
    pluginId: string,
    item: NavigationItem
  ): ResolvedPluginNavigationItem {
    const fullPath = PluginRegistry.resolvePluginPath(pluginId, item.path);
    return {
      pluginId,
      relativePath: item.path,
      fullPath,
      label: item.label,
      icon: item.icon,
      children: item.children?.map((child: NavigationItem) => this.resolveNavigationItem(pluginId, child)),
    };
  }

  public removePluginResources(pluginId: string): void {
    this.routes = this.routes.filter((r) => r.pluginId !== pluginId);
    this.navigationItems = this.navigationItems.filter((n) => n.pluginId !== pluginId);
    this.notify();
  }

  public getRoutes(): readonly ResolvedPluginRoute[] {
    return this.routes;
  }

  public getNavigationItems(): readonly ResolvedPluginNavigationItem[] {
    return this.navigationItems;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[PluginRegistry] Error notifying listener:', err);
      }
    });
  }
}
