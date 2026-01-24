import type {
  AIProvider,
  AIReviewComment,
  Comment,
  CommentsByLine,
  FileDiff,
  PullRequest,
  Repository,
} from "@/types";

import { createFileRoute } from "@tanstack/react-router";
import AlertCircle from "lucide-react/dist/esm/icons/circle-alert";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import FolderGit2 from "lucide-react/dist/esm/icons/folder-git-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Settings from "lucide-react/dist/esm/icons/settings";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import User from "lucide-react/dist/esm/icons/user";
import X from "lucide-react/dist/esm/icons/x";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import {
  ContentSection,
  GlassCard,
  MainContent,
  PageTitle,
} from "@/components/layout/main-content";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { Sidebar, SidebarItem, SidebarSection } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIReviewPanel } from "@/features/ai-review";
import { DiffViewer } from "@/features/diff-viewer";
import {
  PendingReviewBanner,
  PRActions,
  PRActivityTimeline,
  PRDetail,
  PRList,
} from "@/features/pull-requests";
import { parseDiff } from "@/lib/parse-diff";
import {
  addReviewComment,
  approvePullRequest,
  checkGhCliStatus,
  closePullRequest,
  convertReviewCommentsToComments,
  convertToCommentsByLine,
  deletePendingReview,
  deleteReviewComment,
  fetchPRsForRepos,
  getAuthenticatedUser,
  getOrganizationRepositories,
  getPendingReview,
  getPullRequest,
  getPullRequestDiff,
  getReviewComments,
  getUserOrganizations,
  getUserRepositories,
  mergePullRequest,
  replyToReviewComment,
  resolveReviewThread,
  type PendingReview,
  requestChanges,
  submitPendingReview,
  unresolveReviewThread,
  updateReviewComment,
} from "@/services/github";
import {
  checkProviderStatus,
  createPendingReview,
  parseAIReviewResponse,
  startStreamingAIReview,
} from "@/services/ai-review";
import { usePRStore, useReviewStore } from "@/stores";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const PR_STATE_OPTIONS = [
  { value: "all", label: "All states" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
] as const;

const PR_REVIEW_OPTIONS = [
  { value: "all", label: "All reviews" },
  { value: "needs-review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "changes-requested", label: "Changes requested" },
] as const;

const PR_DRAFT_OPTIONS = [
  { value: "all", label: "All PRs" },
  { value: "draft", label: "Draft only" },
  { value: "ready", label: "Ready for review" },
] as const;

const PR_SORT_OPTIONS = [
  { value: "updated", label: "Updated" },
  { value: "created", label: "Created" },
  { value: "size", label: "Size" },
] as const;

function HomeComponent() {
  const { watchedRepos, addWatchedRepo, removeWatchedRepo } = usePRStore();

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [userRepos, setUserRepos] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<Map<string, PullRequest[]>>(new Map());
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
  const [commentsByLine, setCommentsByLine] = useState<CommentsByLine>(new Map());
  const [reviewComments, setReviewComments] = useState<Comment[]>([]);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [scrollToLine, setScrollToLine] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUserRepos, setIsLoadingUserRepos] = useState(false);
  const [isLoadingPRDetails, setIsLoadingPRDetails] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningByProvider, setRunningByProvider] = useState<Record<AIProvider, boolean>>({
    claude: false,
    codex: false,
  });
  const [abortReviewByProvider, setAbortReviewByProvider] = useState<
    Record<AIProvider, (() => Promise<void>) | null>
  >({
    claude: null,
    codex: null,
  });
  const [runningReviewIdByProvider, setRunningReviewIdByProvider] = useState<
    Record<AIProvider, string | null>
  >({
    claude: null,
    codex: null,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [repoTab, setRepoTab] = useState<"personal" | "organizations">("personal");
  const [organizations, setOrganizations] = useState<
    { login: string; description: string | null }[]
  >([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgRepos, setOrgRepos] = useState<Repository[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingOrgRepos, setIsLoadingOrgRepos] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ghReady, setGhReady] = useState(false);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [prSearch, setPrSearch] = useState("");
  const [prStateFilter, setPrStateFilter] = useState<"all" | "open" | "closed" | "merged">("all");
  const [prReviewFilter, setPrReviewFilter] = useState<
    "all" | "needs-review" | "approved" | "changes-requested"
  >("all");
  const [prDraftFilter, setPrDraftFilter] = useState<"all" | "draft" | "ready">("all");
  const [prSortBy, setPrSortBy] = useState<"updated" | "created" | "size">("updated");

  const { config, addReview, updateReview } = useReviewStore();

  // Check gh CLI status and current user on mount
  useEffect(() => {
    const checkSetup = async () => {
      const status = await checkGhCliStatus();
      if (status.installed && status.authenticated) {
        setGhReady(true);
        if (status.username) {
          setCurrentUser(status.username);
        } else {
          // Fallback to getAuthenticatedUser
          const userResult = await getAuthenticatedUser();
          if (userResult.success && userResult.data) {
            setCurrentUser(userResult.data.login);
          }
        }
      } else {
        setShowOnboarding(true);
      }
    };
    checkSetup();
  }, []);

  const fetchPRs = useCallback(async () => {
    if (watchedRepos.length === 0) {
      setPullRequests(new Map());
      setRepositories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await fetchPRsForRepos(watchedRepos);

    if (result.success && result.data) {
      setPullRequests(result.data);

      const repos: Repository[] = watchedRepos.map((fullName) => {
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
      setRepositories(repos);
    } else {
      setError(result.error ?? "Failed to fetch pull requests");
    }

    setIsLoading(false);
  }, [watchedRepos]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  const fetchUserRepos = useCallback(async () => {
    setIsLoadingUserRepos(true);
    const result = await getUserRepositories(100);
    if (result.success && result.data) {
      setUserRepos(result.data);
    }
    setIsLoadingUserRepos(false);
  }, []);

  const fetchOrganizations = useCallback(async () => {
    setIsLoadingOrgs(true);
    const result = await getUserOrganizations();
    if (result.success && result.data) {
      setOrganizations(result.data);
    }
    setIsLoadingOrgs(false);
  }, []);

  const fetchOrgRepos = useCallback(async (org: string) => {
    setIsLoadingOrgRepos(true);
    const result = await getOrganizationRepositories(org, 100);
    if (result.success && result.data) {
      setOrgRepos(result.data);
    }
    setIsLoadingOrgRepos(false);
  }, []);

  const refreshReviewComments = useCallback(async (pr: PullRequest) => {
    const commentsResult = await getReviewComments(pr.repository.fullName, pr.number);
    const comments = commentsResult.success && commentsResult.data ? commentsResult.data : [];

    if (comments.length > 0) {
      setCommentsByLine(convertToCommentsByLine(comments));
      setReviewComments(convertReviewCommentsToComments(comments));
    } else {
      setCommentsByLine(new Map());
      setReviewComments([]);
    }
  }, []);

  useEffect(() => {
    if (showAddRepo && userRepos.length === 0) {
      fetchUserRepos();
    }
    if (showAddRepo && organizations.length === 0) {
      fetchOrganizations();
    }
  }, [showAddRepo, userRepos.length, organizations.length, fetchUserRepos, fetchOrganizations]);

  useEffect(() => {
    if (selectedOrg) {
      fetchOrgRepos(selectedOrg);
    }
  }, [selectedOrg, fetchOrgRepos]);

  const handleAddRepo = useCallback(
    (repoFullName: string) => {
      const trimmed = repoFullName.trim();
      if (trimmed && trimmed.includes("/")) {
        addWatchedRepo(trimmed);
        setRepoInput("");
      }
    },
    [addWatchedRepo],
  );

  const handleRemoveRepo = useCallback(
    (repoFullName: string) => {
      removeWatchedRepo(repoFullName);
    },
    [removeWatchedRepo],
  );

  const fetchPRDetails = useCallback(async (pr: PullRequest) => {
    setIsLoadingPRDetails(true);
    setIsLoadingDiff(true);
    setDiffError(null);
    setPendingReview(null);

    try {
      const [detailsResult, diffResult, pendingReviewResult] = await Promise.all([
        getPullRequest(pr.repository.fullName, pr.number),
        getPullRequestDiff(pr.repository.fullName, pr.number),
        getPendingReview(pr.repository.fullName, pr.number),
      ]);

      if (detailsResult.success && detailsResult.data) {
        const fullPR = detailsResult.data;
        setSelectedPR({
          ...pr,
          body: fullPR.body,
          headRef: fullPR.headRef,
          baseRef: fullPR.baseRef,
          headSha: fullPR.headSha,
          baseSha: fullPR.baseSha,
          additions: fullPR.additions,
          deletions: fullPR.deletions,
          changedFiles: fullPR.changedFiles,
          commits: fullPR.commits,
          reviewDecision: fullPR.reviewDecision,
          reviews: fullPR.reviews,
          reviewRequests: fullPR.reviewRequests,
          mergeable: fullPR.mergeable,
          mergeStateStatus: fullPR.mergeStateStatus,
        });
      }

      if (diffResult.success && diffResult.data) {
        const parsed = parseDiff(diffResult.data);
        setDiffFiles(parsed.files);
        setDiffError(null);
      } else {
        setDiffFiles([]);
        setDiffError(diffResult.error ?? "Failed to fetch diff");
      }

      if (pendingReviewResult.success && pendingReviewResult.data) {
        setPendingReview(pendingReviewResult.data);
      }

      await refreshReviewComments(pr);
    } catch (err) {
      console.error("Failed to fetch PR details:", err);
      setDiffFiles([]);
      setDiffError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoadingPRDetails(false);
      setIsLoadingDiff(false);
    }
  }, []);

  const handleSelectPR = useCallback(
    (pr: PullRequest) => {
      setSelectedPR(pr);
      setDiffFiles([]);
      setDiffError(null);
      fetchPRDetails(pr);
    },
    [fetchPRDetails],
  );

  const handleStartReview = useCallback(
    async (provider: AIProvider, model: string, systemPrompt: string) => {
      if (!selectedPR) return;

      if (runningByProvider[provider]) {
        toast.error("Review already running", {
          description: `A ${provider} review is already in progress.`,
        });
        return;
      }

      // Check if provider is available
      const providerStatus = await checkProviderStatus(provider);
      if (!providerStatus.installed) {
        const providerName = provider === "claude" ? "Claude Code" : "Codex";
        toast.error(`${providerName} CLI not installed`, {
          description: `Please install the ${provider} CLI to use this provider.`,
          action: {
            label: "Learn more",
            onClick: () => {
              const url =
                provider === "claude"
                  ? "https://docs.anthropic.com/en/docs/claude-code"
                  : "https://github.com/openai/codex";
              window.open(url, "_blank");
            },
          },
        });
        return;
      }

      if (!providerStatus.authenticated) {
        const providerName = provider === "claude" ? "Claude Code" : "Codex";
        toast.error(`${providerName} not authenticated`, {
          description: providerStatus.error ?? `Please authenticate the ${provider} CLI.`,
        });
        return;
      }

      setRunningByProvider((prev) => ({ ...prev, [provider]: true }));

      const pendingReview = createPendingReview(
        selectedPR.number,
        selectedPR.repository.fullName,
        provider,
      );
      addReview(pendingReview);
      updateReview(pendingReview.id, { status: "running" });
      setRunningReviewIdByProvider((prev) => ({ ...prev, [provider]: pendingReview.id }));

      const abort = await startStreamingAIReview(
        { number: selectedPR.number, repository: selectedPR.repository.fullName },
        { provider, model, systemPrompt },
        {
          onThinkingStart: () => {},
          onThinkingDelta: () => {},
          onTextDelta: () => {},
          onBlockStop: () => {},
          onComplete: (fullOutput: string) => {
            const parsedReview = parseAIReviewResponse(
              fullOutput,
              selectedPR.number,
              selectedPR.repository.fullName,
              provider,
            );
            updateReview(pendingReview.id, {
              ...parsedReview,
              status: "completed",
            });
            setRunningByProvider((prev) => ({ ...prev, [provider]: false }));
            setAbortReviewByProvider((prev) => ({ ...prev, [provider]: null }));
            setRunningReviewIdByProvider((prev) => ({ ...prev, [provider]: null }));
          },
          onError: (error: string) => {
            updateReview(pendingReview.id, {
              status: "failed",
              error,
            });
            setRunningByProvider((prev) => ({ ...prev, [provider]: false }));
            setAbortReviewByProvider((prev) => ({ ...prev, [provider]: null }));
            setRunningReviewIdByProvider((prev) => ({ ...prev, [provider]: null }));
          },
        },
      );

      setAbortReviewByProvider((prev) => ({ ...prev, [provider]: abort }));
    },
    [selectedPR, runningByProvider, addReview, updateReview],
  );

  const handleCancelReview = useCallback(
    (provider: AIProvider) => {
      const abort = abortReviewByProvider[provider];
      const reviewId = runningReviewIdByProvider[provider];
      if (abort) {
        abort();
      }
      if (reviewId) {
        updateReview(reviewId, {
          status: "failed",
          error: "Review cancelled",
        });
      }
      setRunningByProvider((prev) => ({ ...prev, [provider]: false }));
      setAbortReviewByProvider((prev) => ({ ...prev, [provider]: null }));
      setRunningReviewIdByProvider((prev) => ({ ...prev, [provider]: null }));
    },
    [abortReviewByProvider, runningReviewIdByProvider, updateReview],
  );

  const handleMerge = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("merge");
    const result = await mergePullRequest(
      selectedPR.repository.fullName,
      selectedPR.number,
      "squash",
    );
    if (result.success) {
      toast.success("Pull request merged successfully");
      await fetchPRs();
      setSelectedPR(null);
    } else {
      toast.error("Failed to merge", { description: result.error });
    }
    setActionLoading(null);
  }, [selectedPR, fetchPRs]);

  const handleClose = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("close");
    const result = await closePullRequest(selectedPR.repository.fullName, selectedPR.number);
    if (result.success) {
      toast.success("Pull request closed");
      await fetchPRs();
      setSelectedPR(null);
    } else {
      toast.error("Failed to close PR", { description: result.error });
    }
    setActionLoading(null);
  }, [selectedPR, fetchPRs]);

  const handleApprove = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("approve");
    const result = await approvePullRequest(selectedPR.repository.fullName, selectedPR.number);
    if (result.success) {
      toast.success("Pull request approved");
      await fetchPRDetails(selectedPR);
    } else {
      toast.error("Failed to approve", { description: result.error });
    }
    setActionLoading(null);
  }, [selectedPR, fetchPRDetails]);

  const handleRequestChanges = useCallback(
    async (comment: string) => {
      if (!selectedPR) return;
      setActionLoading("changes");
      const result = await requestChanges(
        selectedPR.repository.fullName,
        selectedPR.number,
        comment,
      );
      if (result.success) {
        toast.success("Changes requested");
        await fetchPRDetails(selectedPR);
      } else {
        toast.error("Failed to request changes", { description: result.error });
      }
      setActionLoading(null);
    },
    [selectedPR, fetchPRDetails],
  );

  const handleSubmitPendingReview = useCallback(
    async (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT", body = "") => {
      if (!selectedPR || !pendingReview) return;
      setActionLoading("submit-review");
      const result = await submitPendingReview(
        selectedPR.repository.fullName,
        selectedPR.number,
        pendingReview.id,
        event,
        body,
      );
      if (result.success) {
        toast.success("Review submitted");
        setPendingReview(null);
        await fetchPRDetails(selectedPR);
      } else {
        toast.error("Failed to submit review", { description: result.error });
      }
      setActionLoading(null);
    },
    [selectedPR, pendingReview, fetchPRDetails],
  );

  const handleDiscardPendingReview = useCallback(async () => {
    if (!selectedPR || !pendingReview) return;
    setActionLoading("discard-review");
    const result = await deletePendingReview(
      selectedPR.repository.fullName,
      selectedPR.number,
      pendingReview.id,
    );
    if (result.success) {
      toast.success("Review discarded");
      setPendingReview(null);
    } else {
      toast.error("Failed to discard review", { description: result.error });
    }
    setActionLoading(null);
  }, [selectedPR, pendingReview]);

  const handleAddComment = useCallback(
    async (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => {
      if (!selectedPR) {
        console.error("No PR selected");
        return;
      }

      if (!selectedPR.headSha) {
        console.error("No headSha available for PR");
        return;
      }

      const result = await addReviewComment(
        selectedPR.repository.fullName,
        selectedPR.number,
        body,
        filePath,
        lineNumber,
        selectedPR.headSha,
        side,
        pendingReview?.nodeId,
      );

      if (result.success) {
        toast.success("Comment added");
        if (pendingReview?.nodeId) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        await refreshReviewComments(selectedPR);
      } else {
        let errorDesc = result.error ?? "Unknown error occurred";
        if (result.error?.includes("pending review")) {
          errorDesc =
            "You have a pending review. Refresh to sync it, or submit/discard it to post single comments.";
          // Refresh to show the pending review banner
          await fetchPRDetails(selectedPR);
        } else if (
          result.error?.includes("pull_request_review_thread.line") ||
          result.error?.includes("Validation Failed")
        ) {
          errorDesc = "Cannot comment on this line. The line may not be part of the diff.";
        }
        toast.error("Failed to add comment", { description: errorDesc });
      }
    },
    [selectedPR, pendingReview, refreshReviewComments, fetchPRDetails],
  );

  const handleReplyToComment = useCallback(
    async (commentId: number, body: string) => {
      if (!selectedPR) return;
      const result = await replyToReviewComment(
        selectedPR.repository.fullName,
        selectedPR.number,
        body,
        commentId,
      );

      if (result.success) {
        toast.success("Reply posted");
        await refreshReviewComments(selectedPR);
      } else {
        toast.error("Failed to reply", { description: result.error });
      }
    },
    [selectedPR, refreshReviewComments],
  );

  const handleEditComment = useCallback(
    async (commentId: number, body: string) => {
      if (!selectedPR) return;
      const result = await updateReviewComment(selectedPR.repository.fullName, commentId, body);
      if (result.success) {
        toast.success("Comment updated");
        await refreshReviewComments(selectedPR);
      } else {
        toast.error("Failed to update comment", { description: result.error });
      }
    },
    [selectedPR, refreshReviewComments],
  );

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!selectedPR) return;
      const result = await deleteReviewComment(selectedPR.repository.fullName, commentId);
      if (result.success) {
        toast.success("Comment deleted");
        await refreshReviewComments(selectedPR);
      } else {
        toast.error("Failed to delete comment", { description: result.error });
      }
    },
    [selectedPR, refreshReviewComments],
  );

  const handleResolveThread = useCallback(
    async (threadId: string) => {
      const result = await resolveReviewThread(threadId);
      if (result.success) {
        toast.success("Thread resolved");
        if (selectedPR) {
          await refreshReviewComments(selectedPR);
        }
      } else {
        toast.error("Failed to resolve thread", { description: result.error });
      }
    },
    [selectedPR, refreshReviewComments],
  );

  const handleUnresolveThread = useCallback(
    async (threadId: string) => {
      const result = await unresolveReviewThread(threadId);
      if (result.success) {
        toast.success("Thread unresolved");
        if (selectedPR) {
          await refreshReviewComments(selectedPR);
        }
      } else {
        toast.error("Failed to unresolve thread", { description: result.error });
      }
    },
    [selectedPR, refreshReviewComments],
  );

  const handlePostAIComment = useCallback(
    async (comment: AIReviewComment): Promise<boolean> => {
      if (!selectedPR || !selectedPR.headSha) {
        toast.error("Cannot post comment", {
          description: "No PR selected or missing commit information.",
        });
        return false;
      }

      // Format the comment body with severity badge and suggestion
      let body = `**[${comment.severity.toUpperCase()}]** ${comment.body}`;
      if (comment.suggestion) {
        body += `\n\n**Suggestion:**\n\`\`\`\n${comment.suggestion}\n\`\`\``;
      }
      body += `\n\n---\n*🤖 AI Review Comment*`;

      const result = await addReviewComment(
        selectedPR.repository.fullName,
        selectedPR.number,
        body,
        comment.path,
        comment.line,
        selectedPR.headSha,
        comment.side,
        pendingReview?.nodeId,
      );

      if (result.success) {
        toast.success("Comment posted to GitHub");
        // Small delay to allow GitHub to process the comment
        await new Promise((resolve) => setTimeout(resolve, 500));
        await refreshReviewComments(selectedPR);
        return true;
      }

      let errorDesc = result.error ?? "Unknown error occurred";
      if (result.error?.includes("pending review")) {
        errorDesc =
          "You have a pending review. Refresh to sync it, or submit/discard it to post single comments.";
        // Refresh to show the pending review banner
        await fetchPRDetails(selectedPR);
      } else if (
        result.error?.includes("pull_request_review_thread.line") ||
        result.error?.includes("Validation Failed")
      ) {
        errorDesc = "Cannot comment on this line. The line may not be part of the diff.";
      }
      toast.error("Failed to post comment", { description: errorDesc });
      return false;
    },
    [selectedPR, pendingReview, refreshReviewComments, fetchPRDetails],
  );

  const totalPRs = Array.from(pullRequests.values()).reduce((sum, prs) => sum + prs.length, 0);

  const prSearchTerm = prSearch.trim().toLowerCase();
  const hasActiveFilters =
    prSearchTerm.length > 0 ||
    prStateFilter !== "all" ||
    prReviewFilter !== "all" ||
    prDraftFilter !== "all";

  const { filteredRepositories, filteredPullRequests } = useMemo(() => {
    const filteredMap = new Map<string, PullRequest[]>();
    const filteredRepos: Repository[] = [];

    const sortValue = (pr: PullRequest) => {
      if (prSortBy === "created") {
        return new Date(pr.createdAt).getTime();
      }
      if (prSortBy === "size") {
        return pr.additions + pr.deletions;
      }
      return new Date(pr.updatedAt).getTime();
    };

    const direction = -1;

    for (const repo of repositories) {
      const prs = pullRequests.get(repo.fullName) ?? [];
      let filtered = prs.filter((pr) => {
        if (prStateFilter !== "all" && pr.state !== prStateFilter) return false;
        if (prDraftFilter === "draft" && !pr.draft) return false;
        if (prDraftFilter === "ready" && pr.draft) return false;
        if (prReviewFilter === "approved" && pr.reviewDecision !== "APPROVED") return false;
        if (prReviewFilter === "changes-requested" && pr.reviewDecision !== "CHANGES_REQUESTED")
          return false;
        if (prReviewFilter === "needs-review") {
          const needsReview =
            pr.state === "open" &&
            !pr.draft &&
            (pr.reviewDecision === "REVIEW_REQUIRED" || pr.reviewDecision === null);
          if (!needsReview) return false;
        }

        if (prSearchTerm) {
          const labelsText = pr.labels
            .map((label) => label.name)
            .join(" ")
            .toLowerCase();
          const haystack = [
            pr.title,
            pr.author.login,
            pr.number.toString(),
            labelsText,
            pr.repository.fullName,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(prSearchTerm)) return false;
        }

        return true;
      });

      if (filtered.length > 0) {
        filtered = filtered.toSorted((a, b) => {
          return (sortValue(a) - sortValue(b)) * direction;
        });
        filteredMap.set(repo.fullName, filtered);
        filteredRepos.push(repo);
      }
    }

    return { filteredRepositories: filteredRepos, filteredPullRequests: filteredMap };
  }, [
    repositories,
    pullRequests,
    prSearchTerm,
    prStateFilter,
    prReviewFilter,
    prDraftFilter,
    prSortBy,
  ]);

  const filteredUserRepos = userRepos.filter(
    (r) =>
      !watchedRepos.includes(r.fullName) &&
      r.fullName.toLowerCase().includes(repoInput.toLowerCase()),
  );

  const filteredOrgRepos = orgRepos.filter(
    (r) =>
      !watchedRepos.includes(r.fullName) &&
      r.fullName.toLowerCase().includes(repoInput.toLowerCase()),
  );

  const sidebarContent = (
    <Sidebar
      header={
        <div className="flex w-full items-center gap-3">
          <img src="/favicon.svg" alt="Lyon" className="size-8 rounded-lg" />
          <span className="text-lg font-bold">Lyon</span>
        </div>
      }
      footer={
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Open PRs</span>
            <span className="font-medium text-foreground">{totalPRs}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Repositories</span>
            <span className="font-medium text-foreground">{watchedRepos.length}</span>
          </div>
        </div>
      }
    >
      <SidebarSection>
        <SidebarItem icon={<RefreshCw className="size-4" />} onClick={fetchPRs} loading={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </SidebarItem>
        <SidebarItem icon={<Plus className="size-4" />} onClick={() => setShowAddRepo(true)}>
          Add Repository
        </SidebarItem>
      </SidebarSection>

      <SidebarSection title="Pull Requests">
        <div className="mb-3 space-y-2 px-2">
          <Input
            value={prSearch}
            onChange={(e) => setPrSearch(e.target.value)}
            placeholder="Search PRs, authors, labels..."
            className="h-9 w-full text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={prStateFilter}
              onValueChange={(value) => setPrStateFilter(value as typeof prStateFilter)}
              items={PR_STATE_OPTIONS}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {PR_STATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={prReviewFilter}
              onValueChange={(value) => setPrReviewFilter(value as typeof prReviewFilter)}
              items={PR_REVIEW_OPTIONS}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Review" />
              </SelectTrigger>
              <SelectContent>
                {PR_REVIEW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={prDraftFilter}
              onValueChange={(value) => setPrDraftFilter(value as typeof prDraftFilter)}
              items={PR_DRAFT_OPTIONS}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Draft" />
              </SelectTrigger>
              <SelectContent>
                {PR_DRAFT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={prSortBy}
              onValueChange={(value) => setPrSortBy(value as typeof prSortBy)}
              items={PR_SORT_OPTIONS}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {PR_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrSearch("");
                setPrStateFilter("all");
                setPrReviewFilter("all");
                setPrDraftFilter("all");
              }}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <AlertCircle className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPRs}>
              Retry
            </Button>
          </div>
        ) : watchedRepos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <FolderGit2 className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No repositories added</p>
            <Button variant="outline" size="sm" onClick={() => setShowAddRepo(true)}>
              <Plus className="mr-1.5 size-3" />
              Add Repository
            </Button>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <AlertCircle className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No pull requests match your filters.</p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPrSearch("");
                  setPrStateFilter("all");
                  setPrReviewFilter("all");
                  setPrDraftFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <PRList
            repositories={filteredRepositories}
            pullRequestsByRepo={filteredPullRequests}
            selectedPR={selectedPR}
            onSelectPR={handleSelectPR}
            isLoading={false}
            onRemoveRepo={handleRemoveRepo}
          />
        )}
      </SidebarSection>

      <SidebarSection title="App">
        <SidebarItem icon={<Settings className="size-4" />} onClick={() => setShowSettings(true)}>
          Settings
        </SidebarItem>
      </SidebarSection>
    </Sidebar>
  );

  return (
    <AppLayout sidebar={sidebarContent}>
      <MainContent
        header={
          selectedPR ? (
            <PageTitle
              description={`${selectedPR.repository.fullName} #${selectedPR.number}`}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPRDetails(selectedPR)}
                    disabled={isLoadingPRDetails}
                  >
                    {isLoadingPRDetails ? (
                      <Spinner size="sm" className="mr-1.5" />
                    ) : (
                      <RefreshCw className="mr-1.5 size-4" />
                    )}
                    Refresh
                  </Button>
                  <PRActions
                    pr={selectedPR}
                    currentUser={currentUser}
                    onMerge={handleMerge}
                    onClose={handleClose}
                    onApprove={handleApprove}
                    onRequestChanges={handleRequestChanges}
                    isLoading={isLoadingPRDetails}
                    loadingAction={
                      actionLoading === "review"
                        ? null
                        : (actionLoading as "merge" | "close" | "approve" | "changes" | null)
                    }
                  />
                </>
              }
            >
              {selectedPR.title}
            </PageTitle>
          ) : (
            <PageTitle description="Select a pull request to review">Dashboard</PageTitle>
          )
        }
      >
        <ContentSection>
          {selectedPR ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {pendingReview && (
                  <PendingReviewBanner
                    onSubmit={handleSubmitPendingReview}
                    onDiscard={handleDiscardPendingReview}
                    isLoading={isLoadingPRDetails}
                    loadingAction={actionLoading}
                    isOwnPR={Boolean(currentUser && selectedPR.author.login === currentUser)}
                    initialBody={pendingReview.body}
                  />
                )}

                <PRDetail pr={selectedPR} />

                <PRActivityTimeline
                  pr={selectedPR}
                  comments={reviewComments}
                  onCommentClick={(path, line) => {
                    setSelectedDiffFile(path);
                    setScrollToLine(line);
                  }}
                />

                <DiffViewer
                  files={diffFiles}
                  isLoading={isLoadingDiff}
                  error={diffError}
                  expectedFiles={selectedPR.changedFiles}
                  selectedFile={selectedDiffFile}
                  onSelectFile={(file) => {
                    setSelectedDiffFile(file);
                    setScrollToLine(null); // Clear scroll position when manually selecting file
                  }}
                  scrollToFile={selectedDiffFile}
                  scrollToLine={scrollToLine}
                  commentsByLine={commentsByLine}
                  onAddComment={handleAddComment}
                  currentUser={currentUser}
                  onReplyComment={handleReplyToComment}
                  onEditComment={handleEditComment}
                  onDeleteComment={handleDeleteComment}
                  onResolveThread={handleResolveThread}
                  onUnresolveThread={handleUnresolveThread}
                />
              </div>

              <div className="flex flex-col gap-6 lg:h-[calc(100vh-10rem)] lg:sticky lg:top-6">
                <AIReviewPanel
                  prNumber={selectedPR.number}
                  repository={selectedPR.repository.fullName}
                  onStartReview={handleStartReview}
                  onCancelReview={() => handleCancelReview(config.provider)}
                  isLoading={runningByProvider[config.provider]}
                  onCommentClick={(filePath, line) => {
                    setSelectedDiffFile(filePath);
                    setScrollToLine(line);
                  }}
                  onPostComment={handlePostAIComment}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center">
              <GlassCard className="max-w-md p-8 text-center" variant="subtle">
                {isLoading ? (
                  <>
                    <Spinner size="xl" className="mx-auto mb-4 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      Loading Pull Requests
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Fetching open PRs from your repositories...
                    </p>
                  </>
                ) : error ? (
                  <>
                    <AlertCircle className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      Failed to Load PRs
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground">{error}</p>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Make sure you have the GitHub CLI installed and authenticated.
                    </p>
                    <Button onClick={fetchPRs}>
                      <RefreshCw className="mr-2 size-4" />
                      Try Again
                    </Button>
                  </>
                ) : watchedRepos.length === 0 ? (
                  <>
                    <FolderGit2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      Add Repositories to Watch
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Add GitHub repositories to see their open pull requests.
                    </p>
                    <Button onClick={() => setShowAddRepo(true)}>
                      <Plus className="mr-2 size-4" />
                      Add Repository
                    </Button>
                  </>
                ) : totalPRs === 0 ? (
                  <>
                    <FolderGit2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      No Open Pull Requests
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Your watched repositories don't have any open PRs.
                    </p>
                    <Button className="mt-6" variant="outline" onClick={fetchPRs}>
                      <RefreshCw className="mr-2 size-4" />
                      Refresh
                    </Button>
                  </>
                ) : (
                  <>
                    <FolderGit2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      Select a Pull Request
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choose a pull request from the sidebar to start reviewing.
                    </p>
                  </>
                )}
              </GlassCard>
            </div>
          )}
        </ContentSection>
      </MainContent>

      {showAddRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Repository</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowAddRepo(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Repository (owner/name)
              </label>
              <div className="flex gap-2">
                <Input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="e.g., facebook/react"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddRepo(repoInput);
                    }
                  }}
                />
                <Button
                  onClick={() => handleAddRepo(repoInput)}
                  disabled={!repoInput.includes("/")}
                >
                  Add
                </Button>
              </div>
            </div>

            {watchedRepos.length > 0 && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Watched Repositories
                </label>
                <div className="max-h-32 rounded-lg border border-glass-border-subtle">
                  <ScrollArea orientation="vertical" className="h-full max-h-32">
                    <div className="space-y-1 p-1">
                      {watchedRepos.map((repo) => (
                        <div
                          key={repo}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                        >
                          <span className="truncate">{repo}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveRepo(repo)}
                          >
                            <Trash2 className="size-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Tabs for Personal/Organizations */}
            <div className="mb-3 flex gap-1 rounded-lg bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setRepoTab("personal");
                  setSelectedOrg(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  repoTab === "personal"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="size-3.5" />
                Personal
              </button>
              <button
                type="button"
                onClick={() => setRepoTab("organizations")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  repoTab === "organizations"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="size-3.5" />
                Organizations
              </button>
            </div>

            {repoTab === "personal" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Your Repositories
                </label>
                {isLoadingUserRepos ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" className="text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-48 rounded-lg border border-glass-border-subtle">
                    <ScrollArea orientation="vertical" className="h-full">
                      <div className="space-y-1 p-1">
                        {filteredUserRepos.slice(0, 20).map((repo) => (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => handleAddRepo(repo.fullName)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{repo.fullName}</div>
                              {repo.description && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {repo.description}
                                </div>
                              )}
                            </div>
                            <Plus className="ml-2 size-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                        {filteredUserRepos.length === 0 && (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            {repoInput ? "No matching repositories" : "No repositories available"}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Organization selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Select Organization
                  </label>
                  {isLoadingOrgs ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size="sm" className="text-muted-foreground" />
                    </div>
                  ) : organizations.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No organizations found
                    </p>
                  ) : (
                    <div className="h-32 rounded-lg border border-glass-border-subtle">
                      <ScrollArea orientation="vertical" className="h-full">
                        <div className="space-y-1 p-1">
                          {organizations.map((org) => (
                            <button
                              key={org.login}
                              type="button"
                              onClick={() => setSelectedOrg(org.login)}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                selectedOrg === org.login
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <Building2 className="size-4 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{org.login}</div>
                                {org.description && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {org.description}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Organization repos */}
                {selectedOrg && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {selectedOrg} Repositories
                    </label>
                    {isLoadingOrgRepos ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner size="sm" className="text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="h-40 rounded-lg border border-glass-border-subtle">
                        <ScrollArea orientation="vertical" className="h-full">
                          <div className="space-y-1 p-1">
                            {filteredOrgRepos.slice(0, 20).map((repo) => (
                              <button
                                key={repo.id}
                                type="button"
                                onClick={() => handleAddRepo(repo.fullName)}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{repo.name}</div>
                                  {repo.description && (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {repo.description}
                                    </div>
                                  )}
                                </div>
                                <Plus className="ml-2 size-4 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                            {filteredOrgRepos.length === 0 && (
                              <p className="py-4 text-center text-xs text-muted-foreground">
                                {repoInput
                                  ? "No matching repositories"
                                  : "No repositories available"}
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowAddRepo(false)}>
                Done
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        watchedRepos={watchedRepos}
      />

      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => {
          setGhReady(true);
          // Fetch user and repos after onboarding
          getAuthenticatedUser().then((result) => {
            if (result.success && result.data) {
              setCurrentUser(result.data.login);
            }
          });
        }}
      />
    </AppLayout>
  );
}
