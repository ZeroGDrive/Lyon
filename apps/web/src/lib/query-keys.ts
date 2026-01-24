const githubBase = ["github"] as const;
const prBase = [...githubBase, "pull-requests"] as const;
const aiBase = ["ai"] as const;

export const queryKeys = {
  github: {
    all: githubBase,
    user: () => [...githubBase, "user"] as const,
    userRepos: () => [...githubBase, "user-repos"] as const,
    organizations: () => [...githubBase, "organizations"] as const,
    orgRepos: (org: string) => [...githubBase, "org-repos", org] as const,
  },

  pullRequests: {
    all: () => prBase,
    forRepos: (repos: string[]) => [...prBase, { repos: repos.toSorted() }] as const,
    detail: (repo: string, number: number) => [...prBase, "detail", repo, number] as const,
    diff: (repo: string, number: number) => [...prBase, "diff", repo, number] as const,
    comments: (repo: string, number: number) => [...prBase, "comments", repo, number] as const,
    pendingReview: (repo: string, number: number) =>
      [...prBase, "pending-review", repo, number] as const,
  },

  ai: {
    all: aiBase,
    providerStatus: (provider: string) => [...aiBase, "status", provider] as const,
  },
} as const;
