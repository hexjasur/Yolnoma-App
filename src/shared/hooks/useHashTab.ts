import { useEffect, useState } from 'react';

export function useHashTab<T extends string>(tabs: readonly T[], defaultTab: T, route: string) {
  const tabIds = new Set(tabs);
  const readTab = () => {
    const query = window.location.hash.split('?')[1];
    const value = query ? new URLSearchParams(query).get('tab') : null;
    return value && tabIds.has(value as T) ? value as T : defaultTab;
  };
  const [tab, setTab] = useState<T>(readTab);

  useEffect(() => {
    const onHashChange = () => setTab(readTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  const selectTab = (next: T) => {
    setTab(next);
    const currentRoute = window.location.hash.split('?')[0] || route;
    window.location.hash = `${currentRoute}?tab=${encodeURIComponent(next)}`;
  };

  return [tab, selectTab] as const;
}
