import { describe, expect, it } from 'vitest';
import { PluginRegistry } from './PluginRegistry';

describe('PluginRegistry', () => {
  it('namespaces plugin routes so features cannot collide', () => {
    expect(PluginRegistry.resolvePluginPath('com.example.tool', '/')).toBe('/plugin/com.example.tool');
    expect(PluginRegistry.resolvePluginPath('com.example.tool', '/settings')).toBe('/plugin/com.example.tool/settings');
    expect(PluginRegistry.resolvePluginPath('com.example.tool', 'settings')).toBe('/plugin/com.example.tool/settings');
  });
});
