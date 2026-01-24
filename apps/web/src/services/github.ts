import type { Branch, Comment, Commit, PullRequest, Repository } from "@/types";

import { logError } from "@/stores/error-log-store";

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface GhCliStatus {
  installed: boolean;
  authenticated: boolean;
  username?: string;
  error?: string;
}

/**
 * Check if gh CLI is installed and authenticated
 */
export async function checkGhCliStatus(): Promise<GhCliStatus> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");

    // First check if gh is installed
    try {
      await invoke<string>("run_shell_command", { command: "which", args: ["gh"] });
    } catch {
      return { installed: false, authenticated: false, error: "gh CLI is not installed" };
    }

    // Check if authenticated by running gh auth status
    try {
      await invoke<string>("run_gh_command", { args: ["auth", "status"] });
      // If we get here, gh is authenticated
      // Try to get the username
      try {
        const userResult = await invoke<string>("run_gh_command", {
          args: ["api", "user", "-q", ".login"],
        });
        return { installed: true, authenticated: true, username: userResult.trim() };
      } catch {
        return { installed: true, authenticated: true };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("not logged in") || errorMsg.includes("authentication")) {
        return { installed: true, authenticated: false, error: "gh CLI is not authenticated" };
      }
      return { installed: true, authenticated: false, error: errorMsg };
    }
  } catch (error) {
    return {
      installed: false,
      authenticated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runGhCommand<T>(args: string[]): Promise<CommandResult<T>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string>("run_gh_command", { args });
    return { success: true, data: JSON.parse(result) as T };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("gh", "gh", errorMsg, { args });
    return { success: false, error: errorMsg };
  }
}

async function runGhCommandRaw(args: string[]): Promise<CommandResult<string>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string>("run_gh_command", { args });
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("gh", "gh", errorMsg, { args });
    return { success: false, error: errorMsg };
  }
}

async function runGhCommandVoid(args: string[]): Promise<CommandResult<void>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke<string>("run_gh_command", { args });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("gh", "gh", errorMsg, { args });
    return { success: false, error: errorMsg };
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
  // gh pr view --json reviews returns a flat array, not { totalCount, nodes }
  reviews: Array<{
    id: string;
    author: { login: string };
    state: string;
    body: string | null;
    submittedAt: string;
  }>;
  // gh pr view --json reviewRequests returns a flat array
  reviewRequests: Array<{ login: string }>;
  // gh pr view --json labels returns a flat array
  labels: Array<{ id: string; name: string; color: string; description: string | null }>;
  // gh pr view --json assignees returns a flat array
  assignees: Array<{ login: string; avatarUrl: string; url: string }>;
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
    reviews: (ghPR.reviews ?? [])
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
    reviewRequests: (ghPR.reviewRequests ?? [])
      .filter((rr) => rr?.login)
      .map((rr) => ({
        requestedReviewer: {
          login: rr.login,
          avatarUrl: `https://github.com/${rr.login}.png`,
          url: `https://github.com/${rr.login}`,
        },
      })),
    labels: (ghPR.labels ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description,
    })),
    assignees: (ghPR.assignees ?? []).map((a) => ({
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

interface GhPRCommentsResult {
  comments: Array<{
    id: string;
    author: { login: string };
    body: string;
    createdAt: string;
    url: string;
  }>;
}

export async function getPullRequestComments(
  repo: string,
  prNumber: number,
): Promise<CommandResult<Comment[]>> {
  const result = await runGhCommand<GhPRCommentsResult>([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "comments",
  ]);

  if (result.success && result.data) {
    const comments: Comment[] = (result.data.comments ?? []).map((c) => ({
      id: c.id,
      author: {
        login: c.author.login,
        avatarUrl: `https://github.com/${c.author.login}.png`,
        url: `https://github.com/${c.author.login}`,
      },
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      url: c.url,
    }));
    return { success: true, data: comments };
  }

  return { success: false, error: result.error };
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

async function runGhCommandWithInput<T>(args: string[], input: string): Promise<CommandResult<T>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string>("run_gh_command_with_input", { args, input });
    return { success: true, data: JSON.parse(result) as T };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("gh", "gh graphql", errorMsg, { args });
    return { success: false, error: errorMsg };
  }
}

async function runGhGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const payload = JSON.stringify({ query, variables });
  const result = await runGhCommandWithInput<GraphqlResponse<T>>(
    ["api", "graphql", "--input", "-"],
    payload,
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const errors = result.data?.errors ?? [];
  if (errors.length > 0) {
    return { success: false, error: errors.map((e) => e.message).join("; ") };
  }

  if (!result.data?.data) {
    return { success: false, error: "Empty response from GitHub GraphQL API" };
  }

  return { success: true, data: result.data.data };
}

export async function addReviewComment(
  repo: string,
  prNumber: number,
  body: string,
  path: string,
  line: number,
  commitId: string,
  side: "LEFT" | "RIGHT" = "RIGHT",
  reviewNodeId?: string,
): Promise<CommandResult<Comment>> {
  if (reviewNodeId) {
    const query = `
      mutation($input: AddPullRequestReviewThreadInput!) {
        addPullRequestReviewThread(input: $input) {
          thread {
            id
          }
        }
      }
    `;

    const result = await runGhGraphql<{
      addPullRequestReviewThread: { thread: { id: string } };
    }>(query, {
      input: {
        pullRequestReviewId: reviewNodeId,
        body,
        path,
        line,
        side,
        subjectType: "LINE",
      },
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  const payload = JSON.stringify({
    body,
    commit_id: commitId,
    path,
    line,
    side,
  });

  return runGhCommandWithInput<Comment>(
    [
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/pulls/${prNumber}/comments`,
      "--input",
      "-",
    ],
    payload,
  );
}

export async function replyToReviewComment(
  repo: string,
  prNumber: number,
  body: string,
  inReplyToId: number,
): Promise<CommandResult<Comment>> {
  const payload = JSON.stringify({
    body,
    in_reply_to: inReplyToId,
  });

  return runGhCommandWithInput<Comment>(
    [
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/pulls/${prNumber}/comments`,
      "--input",
      "-",
    ],
    payload,
  );
}

export async function updateReviewComment(
  repo: string,
  commentId: number,
  body: string,
): Promise<CommandResult<Comment>> {
  const payload = JSON.stringify({ body });
  return runGhCommandWithInput<Comment>(
    [
      "api",
      "--method",
      "PATCH",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/pulls/comments/${commentId}`,
      "--input",
      "-",
    ],
    payload,
  );
}

export async function deleteReviewComment(
  repo: string,
  commentId: number,
): Promise<CommandResult<void>> {
  return runGhCommandVoid([
    "api",
    "--method",
    "DELETE",
    "-H",
    "Accept: application/vnd.github+json",
    `repos/${repo}/pulls/comments/${commentId}`,
  ]);
}

export async function resolveReviewThread(threadId: string): Promise<CommandResult<void>> {
  const query = `
    mutation($input: ResolveReviewThreadInput!) {
      resolveReviewThread(input: $input) {
        thread {
          id
          isResolved
        }
      }
    }
  `;

  return runGhGraphql<void>(query, {
    input: {
      threadId,
    },
  });
}

export async function unresolveReviewThread(threadId: string): Promise<CommandResult<void>> {
  const query = `
    mutation($input: UnresolveReviewThreadInput!) {
      unresolveReviewThread(input: $input) {
        thread {
          id
          isResolved
        }
      }
    }
  `;

  return runGhGraphql<void>(query, {
    input: {
      threadId,
    },
  });
}

// Pending review management

interface GhPendingReview {
  id: number;
  node_id?: string;
  user: {
    login: string;
  };
  body: string;
  state: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submitted_at: string | null;
}

export interface PendingReview {
  id: number;
  nodeId: string;
  user: {
    login: string;
  };
  body: string;
  state: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submittedAt: string | null;
}

export async function getPendingReview(
  repo: string,
  prNumber: number,
): Promise<CommandResult<PendingReview | null>> {
  // Get all reviews and find pending one for current user
  const reviewsResult = await runGhCommand<GhPendingReview[]>([
    "api",
    `repos/${repo}/pulls/${prNumber}/reviews`,
  ]);

  if (!reviewsResult.success) {
    return { success: false, error: reviewsResult.error };
  }

  // Get current user
  const userResult = await runGhCommand<{ login: string }>(["api", "user"]);
  if (!userResult.success || !userResult.data) {
    return { success: false, error: userResult.error ?? "Failed to get current user" };
  }

  const currentUser = userResult.data.login;
  const pendingReview = reviewsResult.data?.find(
    (r) => r.state === "PENDING" && r.user.login === currentUser,
  );

  if (!pendingReview) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      id: pendingReview.id,
      nodeId: pendingReview.node_id ?? "",
      user: pendingReview.user,
      body: pendingReview.body,
      state: pendingReview.state,
      submittedAt: pendingReview.submitted_at,
    },
  };
}

export async function submitPendingReview(
  repo: string,
  prNumber: number,
  reviewId: number,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT",
  body?: string,
): Promise<CommandResult<void>> {
  const payload = JSON.stringify({
    event,
    body: body ?? "",
  });

  return runGhCommandWithInput<void>(
    [
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/pulls/${prNumber}/reviews/${reviewId}/events`,
      "--input",
      "-",
    ],
    payload,
  );
}

export async function deletePendingReview(
  repo: string,
  prNumber: number,
  reviewId: number,
): Promise<CommandResult<void>> {
  return runGhCommand<void>([
    "api",
    "--method",
    "DELETE",
    "-H",
    "Accept: application/vnd.github+json",
    `repos/${repo}/pulls/${prNumber}/reviews/${reviewId}`,
  ]);
}

interface GhReviewComment {
  id: number | string;
  comment_id?: number;
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
  thread_id?: string;
  thread_is_resolved?: boolean;
  viewer_did_author?: boolean;
  state?: "PENDING" | "SUBMITTED";
}

interface GhReviewThreadCommentNode {
  id: string;
  databaseId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  state: "PENDING" | "SUBMITTED";
  viewerDidAuthor: boolean;
  author: {
    login: string;
    avatarUrl: string;
  } | null;
  replyTo?: {
    databaseId: number | null;
  } | null;
}

interface GhReviewThreadNode {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
  startDiffSide: "LEFT" | "RIGHT" | null;
  comments: {
    nodes: GhReviewThreadCommentNode[];
  };
}

export async function getReviewComments(
  repo: string,
  prNumber: number,
): Promise<CommandResult<GhReviewComment[]>> {
  const [owner, name] = repo.split("/");
  const query = `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              path
              line
              originalLine
              diffSide
              startDiffSide
              comments(first: 100) {
                nodes {
                  id
                  databaseId
                  body
                  createdAt
                  updatedAt
                  state
                  viewerDidAuthor
                  replyTo {
                    databaseId
                  }
                  author {
                    login
                    avatarUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await runGhGraphql<{
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: GhReviewThreadNode[];
        };
      } | null;
    } | null;
  }>(query, { owner, name, number: prNumber });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (!result.data) {
    return { success: false, error: "Empty response from GitHub GraphQL API" };
  }

  const threads = result.data.repository?.pullRequest?.reviewThreads.nodes ?? [];
  const mapped: GhReviewComment[] = [];

  for (const thread of threads) {
    const side = thread.diffSide ?? thread.startDiffSide ?? "RIGHT";
    const line = thread.line ?? thread.originalLine;
    if (!line || !thread.path) continue;

    for (const comment of thread.comments.nodes) {
      mapped.push({
        id: comment.id,
        comment_id: comment.databaseId ?? undefined,
        body: comment.body,
        path: thread.path,
        line,
        original_line: thread.originalLine,
        side,
        user: {
          login: comment.author?.login ?? "unknown",
          avatar_url: comment.author?.avatarUrl ?? "",
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        in_reply_to_id: comment.replyTo?.databaseId ?? undefined,
        thread_id: thread.id,
        thread_is_resolved: thread.isResolved,
        viewer_did_author: comment.viewerDidAuthor,
        state: comment.state,
      });
    }
  }

  return { success: true, data: mapped };
}

interface GhPendingReviewThreadComment {
  id: string;
  databaseId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  state: "PENDING" | "SUBMITTED";
  viewerDidAuthor: boolean;
  replyTo?: {
    databaseId: number | null;
  } | null;
  author: {
    login: string;
    avatarUrl: string;
  } | null;
  pullRequestReview: { id: string } | null;
}

interface GhPendingReviewThread {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
  startDiffSide: "LEFT" | "RIGHT" | null;
  comments: {
    nodes: GhPendingReviewThreadComment[];
  };
}

export async function getPendingReviewComments(
  repo: string,
  prNumber: number,
  reviewNodeId: string,
): Promise<CommandResult<GhReviewComment[]>> {
  const [owner, name] = repo.split("/");
  const query = `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              path
              line
              originalLine
              diffSide
              startDiffSide
              comments(first: 100) {
                nodes {
                  id
                  databaseId
                  body
                  createdAt
                  updatedAt
                  state
                  viewerDidAuthor
                  replyTo {
                    databaseId
                  }
                  author {
                    login
                    avatarUrl
                  }
                  pullRequestReview {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await runGhGraphql<{
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: GhPendingReviewThread[];
        };
      } | null;
    } | null;
  }>(query, { owner, name, number: prNumber });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (!result.data) {
    return { success: false, error: "Empty response from GitHub GraphQL API" };
  }

  const threads = result.data.repository?.pullRequest?.reviewThreads.nodes ?? [];
  const mapped: GhReviewComment[] = [];

  for (const thread of threads) {
    const side = thread.diffSide ?? thread.startDiffSide ?? "RIGHT";
    const line = thread.line ?? thread.originalLine;
    if (!line || !thread.path) continue;

    for (const comment of thread.comments.nodes) {
      const belongsToReview = comment.pullRequestReview?.id === reviewNodeId;
      const isViewerDraft = comment.state === "PENDING" && comment.viewerDidAuthor;
      if (!belongsToReview && !isViewerDraft) continue;
      mapped.push({
        id: comment.id,
        comment_id: comment.databaseId ?? undefined,
        body: comment.body,
        path: thread.path,
        line,
        original_line: thread.originalLine,
        side,
        user: {
          login: comment.author?.login ?? "unknown",
          avatar_url: comment.author?.avatarUrl ?? "",
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        in_reply_to_id: comment.replyTo?.databaseId ?? undefined,
        thread_id: thread.id,
        thread_is_resolved: thread.isResolved,
        viewer_did_author: comment.viewerDidAuthor,
        state: comment.state,
      });
    }
  }

  return { success: true, data: mapped };
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
      commentId: comment.comment_id,
      threadId: comment.thread_id,
      threadResolved: comment.thread_is_resolved,
      viewerDidAuthor: comment.viewer_did_author,
      isPending: comment.state === "PENDING",
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

export function convertReviewCommentsToComments(comments: GhReviewComment[]): Comment[] {
  return comments.map((comment) => ({
    id: String(comment.id),
    author: {
      login: comment.user.login,
      avatarUrl: comment.user.avatar_url,
      url: `https://github.com/${comment.user.login}`,
    },
    body: comment.body,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    url: "",
    path: comment.path,
    line: comment.line ?? comment.original_line ?? undefined,
    inReplyToId: comment.in_reply_to_id ? String(comment.in_reply_to_id) : undefined,
  }));
}

export async function mergePullRequest(
  repo: string,
  prNumber: number,
  method: "merge" | "squash" | "rebase" = "merge",
): Promise<CommandResult<void>> {
  return runGhCommandVoid([
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
  return runGhCommandVoid(["pr", "close", String(prNumber), "--repo", repo]);
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
  return runGhCommandVoid(args);
}

export async function requestChanges(
  repo: string,
  prNumber: number,
  body: string,
): Promise<CommandResult<void>> {
  return runGhCommandVoid([
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
  return runGhCommandVoid([
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

interface GhOrgResult {
  login: string;
  description: string | null;
  url: string;
}

export async function getUserOrganizations(): Promise<
  CommandResult<{ login: string; description: string | null }[]>
> {
  const result = await runGhCommand<GhOrgResult[]>(["api", "user/orgs", "--paginate"]);

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.map((org) => ({
        login: org.login,
        description: org.description,
      })),
    };
  }

  return { success: false, error: result.error };
}

export async function getOrganizationRepositories(
  org: string,
  limit = 100,
): Promise<CommandResult<Repository[]>> {
  const result = await runGhCommand<GhRepoResult[]>([
    "repo",
    "list",
    org,
    "--json",
    "name,nameWithOwner,description,url,defaultBranchRef,isPrivate,updatedAt,owner",
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
