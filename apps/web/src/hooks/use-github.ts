import type { PullRequest, Repository } from "@/types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  fetchPRsForRepos,
  getAuthenticatedUser,
  getOrganizationRepositories,
  getPendingReview,
  getPullRequest,
  getPullRequestDiff,
  getReviewComments,
  getUserOrganizations,
  getUserRepositories,
} from "@/services/github";

export function useAuthenticatedUser() {
  return useQuery({
    queryKey: queryKeys.github.user(),
    queryFn: async () => {
      const result = await getAuthenticatedUser();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUserRepositories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.github.userRepos(),
    queryFn: async () => {
      const result = await getUserRepositories(100);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOrganizations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.github.organizations(),
    queryFn: async () => {
      const result = await getUserOrganizations();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOrganizationRepos(org: string | null) {
  return useQuery({
    queryKey: queryKeys.github.orgRepos(org ?? ""),
    queryFn: async () => {
      if (!org) return [];
      const result = await getOrganizationRepositories(org, 100);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !!org,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePullRequestsForRepos(repos: string[]) {
  return useQuery({
    queryKey: queryKeys.pullRequests.forRepos(repos),
    queryFn: async () => {
      if (repos.length === 0)
        return { repos: [] as Repository[], prs: new Map<string, PullRequest[]>() };

      const result = await fetchPRsForRepos(repos);
      if (!result.success) throw new Error(result.error);

      const prsByRepo = result.data ?? new Map<string, PullRequest[]>();
      const repositories: Repository[] = repos.map((fullName) => {
        const [owner, name] = fullName.split("/");
        return {
          id: fullName,
          name: name ?? fullName,
          fullName,
          owner: owner ?? "",
          description: null,
          url: `https://github.com/${fullName}`,
          defaultBranch: "main",
          isPrivate: false,
          updatedAt: new Date().toISOString(),
        };
      });

      return { repos: repositories, prs: prsByRepo };
    },
    enabled: repos.length > 0,
  });
}

export function usePullRequestDetail(repo: string, prNumber: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pullRequests.detail(repo, prNumber),
    queryFn: async () => {
      const result = await getPullRequest(repo, prNumber);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: enabled && !!repo && prNumber > 0,
  });
}

export function usePullRequestDiff(repo: string, prNumber: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pullRequests.diff(repo, prNumber),
    queryFn: async () => {
      const result = await getPullRequestDiff(repo, prNumber);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: enabled && !!repo && prNumber > 0,
  });
}

export function useReviewComments(repo: string, prNumber: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pullRequests.comments(repo, prNumber),
    queryFn: async () => {
      const result = await getReviewComments(repo, prNumber);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: enabled && !!repo && prNumber > 0,
  });
}

export function usePendingReview(repo: string, prNumber: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pullRequests.pendingReview(repo, prNumber),
    queryFn: async () => {
      const result = await getPendingReview(repo, prNumber);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: enabled && !!repo && prNumber > 0,
  });
}

export function useInvalidatePRQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests.all() }),
    invalidateForRepos: (repos: string[]) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests.forRepos(repos) }),
    invalidateDetail: (repo: string, prNumber: number) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests.detail(repo, prNumber) }),
    invalidateComments: (repo: string, prNumber: number) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests.comments(repo, prNumber) }),
    invalidatePendingReview: (repo: string, prNumber: number) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.pullRequests.pendingReview(repo, prNumber),
      }),
  };
}
