import type { AIProvider } from "@/types";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  sidebarWidth: number;
  defaultProvider: AIProvider;
  defaultRepos: string[];
  reducedTransparency: boolean;
  soundEnabled: boolean;

  setSidebarWidth: (width: number) => void;
  setDefaultProvider: (provider: AIProvider) => void;
  addDefaultRepo: (repo: string) => void;
  removeDefaultRepo: (repo: string) => void;
  setReducedTransparency: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sidebarWidth: 280,
      defaultProvider: "claude",
      defaultRepos: [],
      reducedTransparency: false,
      soundEnabled: true,

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
    }),
    {
      name: "settings-store",
    },
  ),
);
