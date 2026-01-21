export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  draft: boolean;
  url: string;
  htmlUrl: string;
  author: GitHubUser;
  headRef: string;
  baseRef: string;
  headSha: string;
  baseSha: string;
  repository: {
    name: string;
    fullName: string;
    owner: string;
  };
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  reviewDecision: ReviewDecision | null;
  reviews: PullRequestReview[];
  reviewRequests: ReviewRequest[];
  labels: Label[];
  assignees: GitHubUser[];
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  mergeable: boolean | null;
  mergeStateStatus: MergeStateStatus;
}

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export type MergeStateStatus =
  | "BEHIND"
  | "BLOCKED"
  | "CLEAN"
  | "DIRTY"
  | "DRAFT"
  | "HAS_HOOKS"
  | "UNKNOWN"
  | "UNSTABLE";

export interface GitHubUser {
  login: string;
  avatarUrl: string;
  url: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface PullRequestReview {
  id: string;
  author: GitHubUser;
  state: ReviewState;
  body: string | null;
  submittedAt: string;
}

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";

export interface ReviewRequest {
  requestedReviewer: GitHubUser;
}

export interface Comment {
  id: string;
  author: GitHubUser;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  path?: string;
  line?: number;
  diffHunk?: string;
  inReplyToId?: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
  ahead: number;
  behind: number;
}
