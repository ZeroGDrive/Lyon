import type { ErrorLog, ErrorLogSource, ErrorLogState } from "@/types/error-log";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_LOGS = 100;

export const useErrorLogStore = create<ErrorLogState>()(
  persist(
    (set, get) => ({
      logs: [],
      maxLogs: MAX_LOGS,

      addLog: (logData) => {
        const log: ErrorLog = {
          ...logData,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        };

        set((state) => {
          const newLogs = [log, ...state.logs];
          if (newLogs.length > state.maxLogs) {
            newLogs.length = state.maxLogs;
          }
          return { logs: newLogs };
        });
      },

      clearLogs: () => set({ logs: [] }),

      clearLogsForSource: (source) =>
        set((state) => ({
          logs: state.logs.filter((log) => log.source !== source),
        })),

      getLogs: (source) => {
        const logs = get().logs;
        if (source) {
          return logs.filter((log) => log.source === source);
        }
        return logs;
      },
    }),
    {
      name: "error-log-store",
      partialize: (state) => ({
        logs: state.logs.slice(0, MAX_LOGS),
      }),
    },
  ),
);

export function logError(
  source: ErrorLogSource,
  command: string,
  error: string,
  options?: {
    args?: string[];
    stderr?: string;
    context?: Record<string, unknown>;
  },
) {
  useErrorLogStore.getState().addLog({
    source,
    command,
    error,
    ...options,
  });
}
