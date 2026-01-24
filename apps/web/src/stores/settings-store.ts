import type { AIProvider } from "@/types";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type NotificationType = "newPr" | "reviewComplete" | "newCommits" | "aiReviewDone";

interface NotificationTypes {
  newPr: boolean;
  reviewComplete: boolean;
  newCommits: boolean;
  aiReviewDone: boolean;
}

interface SettingsState {
  sidebarWidth: number;
  defaultProvider: AIProvider;
  defaultRepos: string[];
  reducedTransparency: boolean;
  soundEnabled: boolean;
  refreshInterval: number;
  notificationTypes: NotificationTypes;

  setSidebarWidth: (width: number) => void;
  setDefaultProvider: (provider: AIProvider) => void;
  addDefaultRepo: (repo: string) => void;
  removeDefaultRepo: (repo: string) => void;
  setReducedTransparency: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setNotificationType: (type: NotificationType, enabled: boolean) => void;
}

const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000;

const DEFAULT_NOTIFICATION_TYPES: NotificationTypes = {
  newPr: true,
  reviewComplete: true,
  newCommits: true,
  aiReviewDone: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sidebarWidth: 280,
      defaultProvider: "claude",
      defaultRepos: [],
      reducedTransparency: false,
      soundEnabled: true,
      refreshInterval: DEFAULT_REFRESH_INTERVAL,
      notificationTypes: { ...DEFAULT_NOTIFICATION_TYPES },

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      setDefaultProvider: (provider) => set({ defaultProvider: provider }),

      addDefaultRepo: (repo) =>
        set((state) => ({
          defaultRepos: [...new Set([...state.defaultRepos, repo])],
        })),

      removeDefaultRepo: (repo) =>
        set((state) => ({
          defaultRepos: state.defaultRepos.filter((r) => r !== repo),
        })),

      setReducedTransparency: (enabled) => set({ reducedTransparency: enabled }),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      setRefreshInterval: (interval) => set({ refreshInterval: interval }),

      setNotificationType: (type, enabled) =>
        set((state) => ({
          notificationTypes: {
            ...state.notificationTypes,
            [type]: enabled,
          },
        })),
    }),
    {
      name: "settings-store",
    },
  ),
);
