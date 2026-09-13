import type { MouseEvent } from 'react';
import { getRouteById, type RouteStatus } from '@/app/routes.config';
import { toast } from '@/shared/ui/Toast';

export const DEV_BYPASS_ROLES = ['owner', 'tester'];

export function getFeatureStatus(featureNameOrPath: string): RouteStatus {
  const key = featureNameOrPath.toLowerCase().trim();
  const route = getRouteById(key) ?? getRouteById(
    key.replace(/^\//, '').replace(/\//g, '-'),
  );
  return route?.status ?? 'stable';
}

export function isFeatureInDevelopment(featureNameOrPath: string): boolean {
  return getFeatureStatus(featureNameOrPath) !== 'stable';
}

export function canAccessDevFeature(role: string | undefined, featureNameOrPath: string): boolean {
  if (!isFeatureInDevelopment(featureNameOrPath)) return true;
  return Boolean(role && DEV_BYPASS_ROLES.includes(role.toLowerCase()));
}

export function handleDevFeatureClick(
  e: MouseEvent,
  featureNameOrPath: string,
  role: string | undefined,
  customMessage?: string,
): boolean {
  if (!canAccessDevFeature(role, featureNameOrPath)) {
    e.preventDefault();
    e.stopPropagation();
    toast.warning(customMessage || 'Cannot access: This feature is currently in development.');
    return true;
  }
  return false;
}
