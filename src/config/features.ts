import { toast } from '@/shared/ui/Toast';

// Features/pages currently in development
export const IN_DEVELOPMENT_FEATURES: Record<string, boolean> = {
  marketplace: true,
  'ai-agent': true,
};

// Roles that are permitted to access and test in-development features
export const DEV_BYPASS_ROLES = ['owner', 'tester'];

/**
 * Checks whether a feature/page is marked as in-development.
 */
export function isFeatureInDevelopment(featureNameOrPath: string): boolean {
  if (!featureNameOrPath) return false;
  const key = featureNameOrPath.toLowerCase().trim();
  if (IN_DEVELOPMENT_FEATURES[key]) return true;
  if (key.includes('marketplace')) return true;
  if (key.includes('ai-agent')) return true;
  // if (key.includes('steam/sam') || key.includes('steam-sam')) return true;
  return false;
}

/**
 * Checks if the current user role can access the given feature.
 * If the feature is NOT in development, returns true.
 * If the feature IS in development, returns true ONLY for owner and tester.
 */
export function canAccessDevFeature(role: string | undefined, featureNameOrPath: string): boolean {
  if (!isFeatureInDevelopment(featureNameOrPath)) {
    return true;
  }
  if (role && DEV_BYPASS_ROLES.includes(role.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Intercepts navigation clicks for in-development items.
 * If the user does not have permission (not owner or tester), prevents navigation and shows a toast.
 * Returns true if navigation was blocked, false if allowed.
 */
export function handleDevFeatureClick(
  e: React.MouseEvent,
  featureNameOrPath: string,
  role: string | undefined,
  customMessage?: string
): boolean {
  if (!canAccessDevFeature(role, featureNameOrPath)) {
    e.preventDefault();
    e.stopPropagation();
    toast.warning(customMessage || 'Cannot access: This feature is currently in development.');
    return true;
  }
  return false;
}
