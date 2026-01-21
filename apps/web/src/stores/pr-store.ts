import type { PullRequest, Repository } from "@/types";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PRState {
  watchedRepos: string[];
  repositories: Repository[];
  pullRequests: Map<string, PullRequest[]>;
  selectedRepo: string | null;
  selectedPR: PullRequest | null;
  isLoadingRepos: boolean;
  isLoadingPRs: boolean;
  error: string | null;

  addWatchedRepo: (repoFullName: string) => void;
  removeWatchedRepo: (repoFullName: string) => void;
  setWatchedRepos: (repos: string[]) => void;
  setRepositories: (repos: Repository[]) => void;
  setPullRequests: (repo: string, prs: PullRequest[]) => void;
  setAllPullRequests: (prsByRepo: Map<string, PullRequest[]>) => void;
  selectRepo: (repoFullName: string | null) => void;
  selectPR: (pr: PullRequest | null) => void;
  setLoadingRepos: (loading: boolean) => void;
  setLoadingPRs: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;
}

export const usePRStore = create<PRState>()(
  persist(
    (set) => ({
      watchedRepos: [],
      repositories: [],
      pullRequests: new Map(),
      selectedRepo: null,
      selectedPR: null,
      isLoadingRepos: false,
      isLoadingPRs: false,
      error: null,

      addWatchedRepo: (repoFullName) =>
        set((state) => ({
          watchedRepos: state.watchedRepos.includes(repoFullName)
            ? state.watchedRepos
            : [...state.watchedRepos, repoFullName],
        })),

      removeWatchedRepo: (repoFullName) =>
        set((state) => ({
          watchedRepos: state.watchedRepos.filter((r) => r !== repoFullName),
          pullRequests: (() => {
            const newMap = new Map(state.pullRequests);
            newMap.delete(repoFullName);
            return newMap;
          })(),
        })),

      setWatchedRepos: (repos) => set({ watchedRepos: repos }),

      setRepositories: (repos) => set({ repositories: repos }),

      setPullRequests: (repo, prs) =>
        set((state) => {
          const newMap = new Map(state.pullRequests);
          newMap.set(repo, prs);
          return { pullRequests: newMap };
        }),

      setAllPullRequests: (prsByRepo) => set({ pullRequests: prsByRepo }),

      selectRepo: (repoFullName) => set({ selectedRepo: repoFullName, selectedPR: null }),

      selectPR: (pr) => set({ selectedPR: pr }),

      setLoadingRepos: (loading) => set({ isLoadingRepos: loading }),

      setLoadingPRs: (loading) => set({ isLoadingPRs: loading }),

      setError: (error) => set({ error }),

      clearAll: () =>
        set({
          repositories: [],
          pullRequests: new Map(),
          selectedRepo: null,
          selectedPR: null,
          error: null,
        }),
    }),
    {
      name: "pr-store",
      partialize: (state) => ({
        watchedRepos: state.watchedRepos,
        selectedRepo: state.selectedRepo,
      }),
    },
  ),
);
