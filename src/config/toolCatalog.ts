import type { ToolDefinition } from '@/app/routes.config';
import { getToolRoutes } from '@/app/routes.config';

export type { ToolDefinition };

export const TOOL_CATALOG: ToolDefinition[] = getToolRoutes().map((route) => ({
  id: route.id,
  label: route.label ?? route.id,
  description: route.description ?? '',
  to: route.path,
  icon: route.icon ?? 'missing-tool-icon',
}));
