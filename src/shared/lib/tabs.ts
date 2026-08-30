export interface TabItem {
  id: string;
  title: string;
  path: string;
  search?: string;
}

export function formatRouteTitle(pathname: string): string {
  let clean = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (clean.startsWith('#/')) clean = clean.slice(2);
  else if (clean.startsWith('#')) clean = clean.slice(1);

  const cleanNoQuery = clean.split('?')[0] || '';
  const segments = cleanNoQuery.split('/').filter(Boolean);

  if (segments.length === 0) return 'Dashboard';

  const first = segments[0];

  if (first === 'videos') {
    return segments.length > 1 ? 'Video' : 'Videos';
  }
  if (first === 'performances') {
    return segments.length > 1 ? 'Performance' : 'Performances';
  }
  if (first === 'tools') {
    if (segments[1] === 'currency') return 'Currency Converter';
    if (segments[1] === 'bg-remover') return 'Background Remover';
    if (segments[1] === 'steam-idler') return 'Steam Idler';
    return 'Tools';
  }
  if (first === 'users') return 'Users';
  if (first === 'profile') return 'Profile';
  if (first === 'settings') return 'Settings';
  if (first === 'login') return 'Login';
  if (first === 'session-limit') return 'Session Management';

  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function generateTabId(): string {
  return 'tab-' + Math.random().toString(36).substring(2, 9);
}
