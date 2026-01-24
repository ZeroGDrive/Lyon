import type { PullRequest } from "@/types";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { useSettingsStore } from "@/stores";

interface PRChange {
  type: "new" | "closed" | "updated";
  pr: PullRequest;
  repo: string;
}

interface UseBackgroundRefreshOptions {
  repos: string[];
  enabled?: boolean;
  onChanges?: (changes: PRChange[]) => void;
}

const DEFAULT_INTERVAL = 5 * 60 * 1000;

export function useBackgroundRefresh({
  repos,
  enabled = true,
  onChanges,
}: UseBackgroundRefreshOptions) {
  const queryClient = useQueryClient();
  const settings = useSettingsStore();
  const previousPRsRef = useRef<Map<string, Map<number, PullRequest>>>(new Map());

  const interval = settings.refreshInterval ?? DEFAULT_INTERVAL;

  const refresh = useCallback(async () => {
    if (repos.length === 0) return;

    try {
      const newData = await queryClient.fetchQuery({
        queryKey: queryKeys.pullRequests.forRepos(repos),
        staleTime: 0,
      });

      if (!newData || !onChanges) return;

      const changes: PRChange[] = [];
      const newPRsMap = new Map<string, Map<number, PullRequest>>();

      for (const repo of repos) {
        const prs = (newData as Map<string, PullRequest[]>).get(repo) ?? [];
        const prMap = new Map<number, PullRequest>();
        for (const pr of prs) {
          prMap.set(pr.number, pr);
        }
        newPRsMap.set(repo, prMap);

        const previousPRs = previousPRsRef.current.get(repo) ?? new Map();

        for (const pr of prs) {
          const prevPR = previousPRs.get(pr.number);
          if (!prevPR) {
            changes.push({ type: "new", pr, repo });
          } else if (pr.updatedAt !== prevPR.updatedAt) {
            changes.push({ type: "updated", pr, repo });
          }
        }

        for (const [prNumber, prevPR] of previousPRs) {
          if (!prMap.has(prNumber)) {
            changes.push({ type: "closed", pr: prevPR, repo });
          }
        }
      }

      previousPRsRef.current = newPRsMap;

      if (changes.length > 0) {
        onChanges(changes);
      }
    } catch {}
  }, [repos, queryClient, onChanges]);

  useEffect(() => {
    if (!enabled || repos.length === 0 || interval <= 0) return;

    const intervalId = setInterval(refresh, interval);

    return () => clearInterval(intervalId);
  }, [enabled, repos, interval, refresh]);

  return { refresh };
}
