import type { Branch, Comment, Commit, PullRequest, Repository } from "@/types";

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function runGhCommand<T>(args: string[]): Promise<CommandResult<T>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string>("run_gh_command", { args });
    return { success: true, data: JSON.parse(result) as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runGhCommandRaw(args: string[]): Promise<CommandResult<string>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string>("run_gh_command", { args });
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface SearchPRResult {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  author: { login: string };
  repository: { name: string; nameWithOwner: string };
  createdAt: string;
  updatedAt: string;
  labels: Array<{ name: string; color: string }>;
  commentsCount: number;
}

interface GhPRViewResult {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  isDraft: boolean;
  url: string;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  headRefOid: string;
  baseRefOid: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: { totalCount: number };
  reviewDecision: string | null;
  reviews: {
    totalCount: number;
    nodes: Array<{
      id: string;
      author: { login: string };
      state: string;
      body: string | null;
      submittedAt: string;
    }>;
  };
  reviewRequests: { nodes: Array<{ requestedReviewer: { login: string } }> };
  labels: { nodes: Array<{ id: string; name: string; color: string; description: string | null }> };
  assignees: { nodes: Array<{ login: string; avatarUrl: string; url: string }> };
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  mergeable: string;
  mergeStateStatus: string;
}

function convertGhPRViewToPullRequest(ghPR: GhPRViewResult, repo: string): PullRequest {
  const [owner, name] = repo.split("/");
  return {
    id: ghPR.id,
    number: ghPR.number,
    title: ghPR.title,
    body: ghPR.body,
    state: ghPR.state.toLowerCase() as "open" | "closed" | "merged",
    draft: ghPR.isDraft,
    url: ghPR.url,
    htmlUrl: ghPR.url,
    author: {
      login: ghPR.author?.login ?? "unknown",
      avatarUrl: ghPR.author?.login ? `https://github.com/${ghPR.author.login}.png` : "",
      url: ghPR.author?.login ? `https://github.com/${ghPR.author.login}` : "",
    },
    headRef: ghPR.headRefName ?? "",
    baseRef: ghPR.baseRefName ?? "",
    headSha: ghPR.headRefOid ?? "",
    baseSha: ghPR.baseRefOid ?? "",
    repository: {
      name: name ?? repo,
      fullName: repo,
      owner: owner ?? "",
    },
    additions: ghPR.additions ?? 0,
    deletions: ghPR.deletions ?? 0,
    changedFiles: ghPR.changedFiles ?? 0,
    commits: ghPR.commits?.totalCount ?? 0,
    reviewDecision: (ghPR.reviewDecision as PullRequest["reviewDecision"]) ?? null,
    reviews: (ghPR.reviews?.nodes ?? [])
      .filter((r) => r?.author?.login)
      .map((r) => ({
        id: r.id,
        author: {
          login: r.author.login,
          avatarUrl: `https://github.com/${r.author.login}.png`,
          url: `https://github.com/${r.author.login}`,
        },
        state: r.state as PullRequest["reviews"][number]["state"],
        body: r.body,
        submittedAt: r.submittedAt,
      })),
    reviewRequests: (ghPR.reviewRequests?.nodes ?? [])
      .filter((rr) => rr?.requestedReviewer?.login)
      .map((rr) => ({
        requestedReviewer: {
          login: rr.requestedReviewer.login,
          avatarUrl: `https://github.com/${rr.requestedReviewer.login}.png`,
          url: `https://github.com/${rr.requestedReviewer.login}`,
        },
      })),
    labels: (ghPR.labels?.nodes ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description,
    })),
    assignees: (ghPR.assignees?.nodes ?? []).map((a) => ({
      login: a.login,
      avatarUrl: a.avatarUrl,
      url: a.url,
    })),
    createdAt: ghPR.createdAt,
    updatedAt: ghPR.updatedAt,
    mergedAt: ghPR.mergedAt,
    closedAt: ghPR.closedAt,
    mergeable:
      ghPR.mergeable === "MERGEABLE" ? true : ghPR.mergeable === "CONFLICTING" ? false : null,
    mergeStateStatus: (ghPR.mergeStateStatus as PullRequest["mergeStateStatus"]) ?? "UNKNOWN",
  };
}

export async function searchAllOpenPRs(): Promise<CommandResult<SearchPRResult[]>> {
  const fields = [
    "number",
    "title",
    "state",
    "isDraft",
    "url",
    "author",
    "repository",
    "createdAt",
    "updatedAt",
    "labels",
    "commentsCount",
  ].join(",");

  return runGhCommand<SearchPRResult[]>([
    "search",
    "prs",
    "--state=open",
    "--involves=@me",
    "--json",
    fields,
    "--limit",
    "100",
  ]);
}

export async function searchMyOpenPRs(): Promise<CommandResult<SearchPRResult[]>> {
  const fields = [
    "number",
    "title",
    "state",
    "isDraft",
    "url",
    "author",
    "repository",
    "createdAt",
    "updatedAt",
    "labels",
    "commentsCount",
  ].join(",");

  return runGhCommand<SearchPRResult[]>([
    "search",
    "prs",
    "--state=open",
    "--author=@me",
    "--json",
    fields,
    "--limit",
    "100",
  ]);
}

export async function searchReviewRequestedPRs(): Promise<CommandResult<SearchPRResult[]>> {
  const fields = [
    "number",
    "title",
    "state",
    "isDraft",
    "url",
    "author",
    "repository",
    "createdAt",
    "updatedAt",
    "labels",
    "commentsCount",
  ].join(",");

  return runGhCommand<SearchPRResult[]>([
    "search",
    "prs",
    "--state=open",
    "--review-requested=@me",
    "--json",
    fields,
    "--limit",
    "100",
  ]);
}

export function groupPRsByRepository(prs: SearchPRResult[]): Map<string, SearchPRResult[]> {
  const grouped = new Map<string, SearchPRResult[]>();
  for (const pr of prs) {
    const repoName = pr.repository.nameWithOwner;
    const existing = grouped.get(repoName) ?? [];
    existing.push(pr);
    grouped.set(repoName, existing);
  }
  return grouped;
}

export function getUniqueRepositories(prs: SearchPRResult[]): Repository[] {
  const seen = new Set<string>();
  const repos: Repository[] = [];

  for (const pr of prs) {
    const fullName = pr.repository.nameWithOwner;
    if (!seen.has(fullName)) {
      seen.add(fullName);
      const [owner, name] = fullName.split("/");
      repos.push({
        id: fullName,
        name: name ?? fullName,
        fullName,
        owner: owner ?? "",
        description: null,
        url: `https://github.com/${fullName}`,
        defaultBranch: "main",
        isPrivate: false,
        updatedAt: pr.updatedAt,
      });
    }
  }

  return repos;
}

export function convertSearchPRToPullRequest(pr: SearchPRResult): PullRequest {
  const [owner, name] = pr.repository.nameWithOwner.split("/");
  return {
    id: `${pr.repository.nameWithOwner}#${pr.number}`,
    number: pr.number,
    title: pr.title,
    body: null,
    state: pr.state as "open" | "closed" | "merged",
    draft: pr.isDraft,
    url: pr.url,
    htmlUrl: pr.url,
    author: {
      login: pr.author.login,
      avatarUrl: `https://github.com/${pr.author.login}.png`,
      url: `https://github.com/${pr.author.login}`,
    },
    headRef: "",
    baseRef: "",
    headSha: "",
    baseSha: "",
    repository: {
      name: name ?? pr.repository.name,
      fullName: pr.repository.nameWithOwner,
      owner: owner ?? "",
    },
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    commits: 0,
    reviewDecision: null,
    reviews: [],
    reviewRequests: [],
    labels: pr.labels.map((l) => ({
      id: l.name,
      name: l.name,
      color: l.color,
      description: null,
    })),
    assignees: [],
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    mergedAt: null,
    closedAt: null,
    mergeable: null,
    mergeStateStatus: "UNKNOWN",
  };
}

export async function listPullRequests(
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<CommandResult<PullRequest[]>> {
  const fields = [
    "id",
    "number",
    "title",
    "body",
    "state",
    "isDraft",
    "url",
    "author",
    "headRefName",
    "baseRefName",
    "headRefOid",
    "baseRefOid",
    "additions",
    "deletions",
    "changedFiles",
    "commits",
    "reviewDecision",
    "reviews",
    "reviewRequests",
    "labels",
    "assignees",
    "createdAt",
    "updatedAt",
    "mergedAt",
    "closedAt",
    "mergeable",
    "mergeStateStatus",
  ].join(",");

  return runGhCommand<PullRequest[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--json",
    fields,
    "--limit",
    "100",
  ]);
}

export async function getPullRequest(
  repo: string,
  prNumber: number,
): Promise<CommandResult<PullRequest>> {
  const fields = [
    "id",
    "number",
    "title",
    "body",
    "state",
    "isDraft",
    "url",
    "author",
    "headRefName",
    "baseRefName",
    "headRefOid",
    "baseRefOid",
    "additions",
    "deletions",
    "changedFiles",
    "commits",
    "reviewDecision",
    "reviews",
    "reviewRequests",
    "labels",
    "assignees",
    "createdAt",
    "updatedAt",
    "mergedAt",
    "closedAt",
    "mergeable",
    "mergeStateStatus",
  ].join(",");

  const result = await runGhCommand<GhPRViewResult>([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    fields,
  ]);

  if (result.success && result.data) {
    return {
      success: true,
      data: convertGhPRViewToPullRequest(result.data, repo),
    };
  }

  return {
    success: false,
    error: result.error,
  };
}

export async function getPullRequestDiff(
  repo: string,
  prNumber: number,
): Promise<CommandResult<string>> {
  return runGhCommandRaw(["pr", "diff", String(prNumber), "--repo", repo]);
}

export async function getPullRequestComments(
  repo: string,
  prNumber: number,
): Promise<CommandResult<Comment[]>> {
  return runGhCommand<Comment[]>([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "comments",
  ]);
}

export async function getPullRequestReviewComments(
  repo: string,
  prNumber: number,
): Promise<CommandResult<Comment[]>> {
  return runGhCommand<Comment[]>(["api", `repos/${repo}/pulls/${prNumber}/comments`, "--jq", "."]);
}

export async function addPullRequestComment(
  repo: string,
  prNumber: number,
  body: string,
): Promise<CommandResult<Comment>> {
  return runGhCommand<Comment>(["pr", "comment", String(prNumber), "--repo", repo, "--body", body]);
}

export async function addReviewComment(
  repo: string,
  prNumber: number,
  body: string,
  path: string,
  line: number,
  commitId: string,
  side: "LEFT" | "RIGHT" = "RIGHT",
): Promise<CommandResult<Comment>> {
  return runGhCommand<Comment>([
    "api",
    "--method",
    "POST",
    `repos/${repo}/pulls/${prNumber}/comments`,
    "-f",
    `body=${body}`,
    "-f",
    `path=${path}`,
    "-F",
    `line=${line}`,
    "-f",
    `commit_id=${commitId}`,
    "-f",
    `side=${side}`,
    "-f",
    "subject_type=line",
  ]);
}

interface GhReviewComment {
  id: number;
  body: string;
  path: string;
  line: number | null;
  original_line: number | null;
  side: "LEFT" | "RIGHT";
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
}

export async function getReviewComments(
  repo: string,
  prNumber: number,
): Promise<CommandResult<GhReviewComment[]>> {
  return runGhCommand<GhReviewComment[]>([
    "api",
    `repos/${repo}/pulls/${prNumber}/comments`,
    "--paginate",
  ]);
}

export function convertToCommentsByLine(
  comments: GhReviewComment[],
): Map<string, import("@/types").LineComment[]> {
  const commentsByLine = new Map<string, import("@/types").LineComment[]>();

  for (const comment of comments) {
    const lineNumber = comment.line ?? comment.original_line;
    if (!lineNumber || !comment.path) continue;

    const key = `${comment.path}:${lineNumber}:${comment.side}`;
    const existing = commentsByLine.get(key) ?? [];

    existing.push({
      id: String(comment.id),
      path: comment.path,
      line: lineNumber,
      side: comment.side,
      body: comment.body,
      author: {
        login: comment.user.login,
        avatarUrl: comment.user.avatar_url,
      },
      createdAt: comment.created_at,
      isAIGenerated: false,
    });

    commentsByLine.set(key, existing);
  }

  return commentsByLine;
}

export async function mergePullRequest(
  repo: string,
  prNumber: number,
  method: "merge" | "squash" | "rebase" = "merge",
): Promise<CommandResult<void>> {
  return runGhCommand<void>([
    "pr",
    "merge",
    String(prNumber),
    "--repo",
    repo,
    `--${method}`,
    "--auto",
  ]);
}

export async function closePullRequest(
  repo: string,
  prNumber: number,
): Promise<CommandResult<void>> {
  return runGhCommand<void>(["pr", "close", String(prNumber), "--repo", repo]);
}

export async function approvePullRequest(
  repo: string,
  prNumber: number,
  body?: string,
): Promise<CommandResult<void>> {
  const args = ["pr", "review", String(prNumber), "--repo", repo, "--approve"];
  if (body) {
    args.push("--body", body);
  }
  return runGhCommand<void>(args);
}

export async function requestChanges(
  repo: string,
  prNumber: number,
  body: string,
): Promise<CommandResult<void>> {
  return runGhCommand<void>([
    "pr",
    "review",
    String(prNumber),
    "--repo",
    repo,
    "--request-changes",
    "--body",
    body,
  ]);
}

export async function deleteBranch(repo: string, branchName: string): Promise<CommandResult<void>> {
  return runGhCommand<void>([
    "api",
    "--method",
    "DELETE",
    `repos/${repo}/git/refs/heads/${branchName}`,
  ]);
}

export async function listBranches(repo: string): Promise<CommandResult<Branch[]>> {
  return runGhCommand<Branch[]>(["api", `repos/${repo}/branches`, "--jq", "."]);
}

export async function getPullRequestCommits(
  repo: string,
  prNumber: number,
): Promise<CommandResult<Commit[]>> {
  return runGhCommand<Commit[]>([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "commits",
  ]);
}

export async function getAuthenticatedUser(): Promise<CommandResult<{ login: string }>> {
  return runGhCommand<{ login: string }>(["api", "user", "--jq", "."]);
}

interface GhRepoResult {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  defaultBranchRef: { name: string } | null;
  isPrivate: boolean;
  updatedAt: string;
  owner: { login: string };
}

export async function getUserRepositories(limit = 50): Promise<CommandResult<Repository[]>> {
  const fields = [
    "name",
    "nameWithOwner",
    "description",
    "url",
    "defaultBranchRef",
    "isPrivate",
    "updatedAt",
    "owner",
  ].join(",");

  const result = await runGhCommand<GhRepoResult[]>([
    "repo",
    "list",
    "--json",
    fields,
    "--limit",
    String(limit),
  ]);

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.map((r) => ({
        id: r.nameWithOwner,
        name: r.name,
        fullName: r.nameWithOwner,
        owner: r.owner.login,
        description: r.description,
        url: r.url,
        defaultBranch: r.defaultBranchRef?.name ?? "main",
        isPrivate: r.isPrivate,
        updatedAt: r.updatedAt,
      })),
    };
  }

  return { success: false, error: result.error };
}

interface GhPRListResult {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  isDraft: boolean;
  url: string;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
  labels: Array<{ id: string; name: string; color: string; description: string | null }>;
}

export async function listRepoPullRequests(
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<CommandResult<PullRequest[]>> {
  const fields = [
    "id",
    "number",
    "title",
    "body",
    "state",
    "isDraft",
    "url",
    "author",
    "headRefName",
    "baseRefName",
    "additions",
    "deletions",
    "changedFiles",
    "createdAt",
    "updatedAt",
    "labels",
  ].join(",");

  const result = await runGhCommand<GhPRListResult[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--json",
    fields,
    "--limit",
    "50",
  ]);

  if (result.success && result.data) {
    const [owner, name] = repo.split("/");
    return {
      success: true,
      data: result.data.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state.toLowerCase() as "open" | "closed" | "merged",
        draft: pr.isDraft,
        url: pr.url,
        htmlUrl: pr.url,
        author: {
          login: pr.author.login,
          avatarUrl: `https://github.com/${pr.author.login}.png`,
          url: `https://github.com/${pr.author.login}`,
        },
        headRef: pr.headRefName,
        baseRef: pr.baseRefName,
        headSha: "",
        baseSha: "",
        repository: {
          name: name ?? repo,
          fullName: repo,
          owner: owner ?? "",
        },
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        commits: 0,
        reviewDecision: null,
        reviews: [],
        reviewRequests: [],
        labels: pr.labels.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          description: l.description,
        })),
        assignees: [],
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        mergedAt: null,
        closedAt: null,
        mergeable: null,
        mergeStateStatus: "UNKNOWN" as const,
      })),
    };
  }

  return { success: false, error: result.error };
}

export async function fetchPRsForRepos(
  repos: string[],
): Promise<CommandResult<Map<string, PullRequest[]>>> {
  const prsByRepo = new Map<string, PullRequest[]>();
  const errors: string[] = [];

  const results = await Promise.all(
    repos.map(async (repo) => {
      const result = await listRepoPullRequests(repo, "open");
      return { repo, result };
    }),
  );

  for (const { repo, result } of results) {
    if (result.success && result.data) {
      prsByRepo.set(repo, result.data);
    } else if (result.error) {
      errors.push(`${repo}: ${result.error}`);
    }
  }

  if (prsByRepo.size === 0 && errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return { success: true, data: prsByRepo };
}
