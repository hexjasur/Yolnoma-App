import type React from 'react';
import type { PluginDefinition, PluginManifest, RouteDefinition } from '@yolnoma/plugin-sdk';

/** Runtime lifecycle state of a plugin in Yolnoma */
export type PluginStatus = 'registered' | 'active' | 'inactive' | 'error';

/** Registered plugin record in the runtime */
export interface RuntimePlugin {
  readonly manifest: PluginManifest;
  readonly definition: PluginDefinition;
  status: PluginStatus;
  error?: Error;
}

/** Route resolved and namespaced for React Router */
export interface ResolvedPluginRoute {
  readonly pluginId: string;
  readonly relativePath: string;
  /** Full route path mounted in HashRouter, e.g. "/plugin/com.jksoftware.json-validator" or "/plugin/com.jksoftware.json-validator/settings" */
  readonly fullPath: string;
  readonly component: RouteDefinition['component'] | React.ComponentType<any>;
  readonly meta?: {
    readonly title?: string;
  };
}

/** Navigation item resolved and namespaced for Yolnoma Sidebar */
export interface ResolvedPluginNavigationItem {
  readonly pluginId: string;
  readonly relativePath: string;
  /** Full route path, e.g. "/plugin/com.jksoftware.json-validator" */
  readonly fullPath: string;
  readonly label: string;
  readonly icon?: React.ReactNode | string;
  readonly children?: readonly ResolvedPluginNavigationItem[];
}
