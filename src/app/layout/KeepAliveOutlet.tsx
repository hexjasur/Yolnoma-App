import { useLocation, useOutlet } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type CachedTab = {
  key: string;
  element: ReactNode;
  lastAccessed: number;
};

const MAX_CACHED_TABS = 10;

export default function KeepAliveOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const currentKey = location.pathname;

  const [cache, setCache] = useState<Map<string, CachedTab>>(() => new Map());
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  // Add or update current view in cache
  useEffect(() => {
    if (!outlet) return;

    setCache((prevCache) => {
      const next = new Map(prevCache);

      // If already cached, update lastAccessed timestamp and current element
      if (next.has(currentKey)) {
        next.set(currentKey, {
          key: currentKey,
          element: outlet,
          lastAccessed: Date.now(),
        });
        return next;
      }

      // Memory Saver guard: Limit to MAX_CACHED_TABS
      if (next.size >= MAX_CACHED_TABS) {
        // Evict the least recently accessed tab
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, item] of next.entries()) {
          if (item.lastAccessed < oldestTime) {
            oldestTime = item.lastAccessed;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          next.delete(oldestKey);
        }
      }

      next.set(currentKey, {
        key: currentKey,
        element: outlet,
        lastAccessed: Date.now(),
      });

      return next;
    });
  }, [currentKey, outlet]);

  // Listen for tab closed events to eagerly free memory (Chrome Memory Saver approach)
  useEffect(() => {
    const handleTabClosed = (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string }>;
      const closedPath = customEvent.detail?.path;
      if (closedPath && cacheRef.current.has(closedPath)) {
        setCache((prev) => {
          const next = new Map(prev);
          next.delete(closedPath);
          return next;
        });
      }
    };

    window.addEventListener('yolnoma:tab-closed', handleTabClosed);
    return () => {
      window.removeEventListener('yolnoma:tab-closed', handleTabClosed);
    };
  }, []);

  return (
    <>
      {Array.from(cache.entries()).map(([key, tab]) => {
        const isActive = key === currentKey;
        return (
          <div
            key={key}
            style={{
              display: isActive ? 'block' : 'none',
              height: '100%',
              width: '100%',
            }}
            aria-hidden={!isActive}
          >
            {tab.element}
          </div>
        );
      })}
    </>
  );
}
