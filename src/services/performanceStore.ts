import { performanceService } from './performance.service';
import type { Performance } from '@/types';

type Listener = () => void;

interface StoreState {
  items: Performance[];
  loading: boolean;
  error: string | null;
}

class PerformanceStore {
  private state: StoreState = {
    items: [],
    loading: false,
    error: null,
  };
  
  private listeners = new Set<Listener>();
  private hasFetched = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }
  
  private updateState(partial: Partial<StoreState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  // Returns the exact same reference unless state changes,
  // preventing useSyncExternalStore infinite loop
  getSnapshot = () => this.state;

  async fetch(force = false) {
    if (this.hasFetched && !force) return;
    
    this.updateState({ loading: true, error: null });

    try {
      const items = await performanceService.list();
      this.hasFetched = true;
      this.updateState({ items, loading: false });
    } catch (err) {
      this.updateState({ error: String(err), loading: false });
    }
  }

  addLocal(item: Performance) {
    this.updateState({ items: [item, ...this.state.items] });
  }

  updateLocal(updated: Performance) {
    this.updateState({ 
      items: this.state.items.map((p) => (p.id === updated.id ? updated : p)) 
    });
  }

  removeLocal(id: string) {
    this.updateState({ 
      items: this.state.items.filter((p) => p.id !== id) 
    });
  }
}

export const performanceStore = new PerformanceStore();
