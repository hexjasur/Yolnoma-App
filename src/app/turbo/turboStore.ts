import { create } from "zustand";
import type {
  TurboError,
  TurboLog,
  TurboLogLevel,
  TurboRequest,
  TurboTab,
} from "./turboTypes";

const MAX_ERRORS = 100;
const MAX_LOGS = 200;
const MAX_REQUESTS = 150;

interface TurboState {
  errors: TurboError[];
  logs: TurboLog[];
  requests: TurboRequest[];
  activeTab: TurboTab;

  addError: (error: Omit<TurboError, "id" | "timestamp">) => void;
  clearErrors: () => void;

  addLog: (
    level: TurboLogLevel,
    args: unknown[],
    formattedMessage: string,
  ) => void;
  clearLogs: () => void;

  addRequest: (request: TurboRequest) => void;
  updateRequest: (id: string, updates: Partial<TurboRequest>) => void;
  clearRequests: () => void;

  setActiveTab: (tab: TurboTab) => void;
  resetAll: () => void;
}

export const useTurboStore = create<TurboState>((set) => ({
  errors: [],
  logs: [],
  requests: [],
  activeTab: "overview",

  addError: (err) => {
    const newError: TurboError = {
      ...err,
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      errors: [newError, ...state.errors].slice(0, MAX_ERRORS),
    }));
  },

  clearErrors: () => set({ errors: [] }),

  addLog: (level, args, formattedMessage) => {
    set((state) => {
      const prevLogs = state.logs;
      const last = prevLogs[0];

      // Deduplicate consecutive identical messages
      if (
        last &&
        last.level === level &&
        last.formattedMessage === formattedMessage
      ) {
        const updated = [...prevLogs];
        updated[0] = {
          ...last,
          count: last.count + 1,
          timestamp: Date.now(),
        };
        return { logs: updated };
      }

      const newLog: TurboLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        level,
        args,
        formattedMessage,
        timestamp: Date.now(),
        count: 1,
      };

      return {
        logs: [newLog, ...prevLogs].slice(0, MAX_LOGS),
      };
    });
  },

  clearLogs: () => set({ logs: [] }),

  addRequest: (request) => {
    set((state) => ({
      requests: [request, ...state.requests].slice(0, MAX_REQUESTS),
    }));
  },

  updateRequest: (id, updates) => {
    set((state) => ({
      requests: state.requests.map((req) =>
        req.id === id ? { ...req, ...updates } : req,
      ),
    }));
  },

  clearRequests: () => set({ requests: [] }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  resetAll: () => set({ errors: [], logs: [], requests: [] }),
}));
