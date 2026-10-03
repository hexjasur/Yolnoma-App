import { create } from "zustand";
import { steamApi } from "@/features/steam/api/steamApi";

const IDLE_START_TIMES_KEY = "yolnoma_steam_idle_start_times";

function getStoredStartTimes(): Record<number, number> {
  try {
    const raw = localStorage.getItem(IDLE_START_TIMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const result: Record<number, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const numKey = Number(k);
        const numVal = Number(v);
        if (Number.isFinite(numKey) && Number.isFinite(numVal) && numVal > 0) {
          result[numKey] = numVal;
        }
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

function persistStartTimes(startTimes: Record<number, number>) {
  try {
    localStorage.setItem(IDLE_START_TIMES_KEY, JSON.stringify(startTimes));
  } catch {
    // Ignore localStorage write errors
  }
}

export interface IdlingStore {
  idlingIds: Set<number>;
  startTimes: Record<number, number>;
  setAppIds: (appIds: number[]) => void;
  syncIdleState: () => Promise<number[]>;
  stopOne: (appId: number) => Promise<void>;
  stopAll: () => Promise<void>;
}

export const useIdlingStore = create<IdlingStore>((set, get) => ({
  idlingIds: new Set<number>(),
  startTimes: getStoredStartTimes(),

  setAppIds: (appIds: number[]) => {
    const state = get();
    const prevStartTimes = state.startTimes;
    const now = Date.now();
    const nextStartTimes: Record<number, number> = {};

    for (const appId of appIds) {
      nextStartTimes[appId] = prevStartTimes[appId] ?? now;
    }

    persistStartTimes(nextStartTimes);
    set({
      idlingIds: new Set(appIds),
      startTimes: nextStartTimes,
    });
  },

  syncIdleState: async () => {
    try {
      const ids = await steamApi.getIdleState();
      get().setAppIds(ids);
      return ids;
    } catch {
      return [];
    }
  },

  stopOne: async (appId: number) => {
    try {
      await steamApi.stopIdling(appId);
    } finally {
      await get().syncIdleState();
    }
  },

  stopAll: async () => {
    try {
      await steamApi.stopAllIdling();
    } finally {
      await get().syncIdleState();
    }
  },
}));
