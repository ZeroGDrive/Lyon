import type { AIProvider, CommentsByLine, FileDiff, PullRequest, Repository } from "@/types";

import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  FolderGit2,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import {
  ContentSection,
  GlassCard,
  MainContent,
  PageTitle,
} from "@/components/layout/main-content";
import { Sidebar, SidebarItem, SidebarSection } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIReviewPanel } from "@/features/ai-review";
import { DiffViewer } from "@/features/diff-viewer";
import { PRActions, PRDetail, PRList } from "@/features/pull-requests";
import { parseDiff } from "@/lib/parse-diff";
import {
  addReviewComment,
  approvePullRequest,
  closePullRequest,
  convertToCommentsByLine,
  fetchPRsForRepos,
  getPullRequest,
  getPullRequestDiff,
  getReviewComments,
  getUserRepositories,
  mergePullRequest,
  requestChanges,
} from "@/services/github";
import {
  createPendingReview,
  parseAIReviewResponse,
  startStreamingAIReview,
} from "@/services/ai-review";
import { usePRStore, useReviewStore } from "@/stores";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { watchedRepos, addWatchedRepo, removeWatchedRepo } = usePRStore();

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [userRepos, setUserRepos] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<Map<string, PullRequest[]>>(new Map());
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
  const [commentsByLine, setCommentsByLine] = useState<CommentsByLine>(new Map());
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [scrollToLine, setScrollToLine] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUserRepos, setIsLoadingUserRepos] = useState(false);
  const [isLoadingPRDetails, setIsLoadingPRDetails] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [abortReview, setAbortReview] = useState<(() => Promise<void>) | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [repoInput, setRepoInput] = useState("");

  const { config, addReview, updateReview } = useReviewStore();

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

  useEffect(() => {
    if (showAddRepo && userRepos.length === 0) {
      fetchUserRepos();
    }
  }, [showAddRepo, userRepos.length, fetchUserRepos]);

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

    try {
      const [detailsResult, diffResult, commentsResult] = await Promise.all([
        getPullRequest(pr.repository.fullName, pr.number),
        getPullRequestDiff(pr.repository.fullName, pr.number),
        getReviewComments(pr.repository.fullName, pr.number),
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

      if (commentsResult.success && commentsResult.data) {
        setCommentsByLine(convertToCommentsByLine(commentsResult.data));
      } else {
        setCommentsByLine(new Map());
      }
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
    async (provider: AIProvider, systemPrompt: string) => {
      if (!selectedPR) return;

      setIsReviewing(true);

      const pendingReview = createPendingReview(
        selectedPR.number,
        selectedPR.repository.fullName,
        provider,
      );
      addReview(pendingReview);
      updateReview(pendingReview.id, { status: "running" });

      const abort = await startStreamingAIReview(
        { number: selectedPR.number, repository: selectedPR.repository.fullName },
        { provider, systemPrompt },
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
            setIsReviewing(false);
            setAbortReview(null);
          },
          onError: (error: string) => {
            updateReview(pendingReview.id, {
              status: "failed",
              error,
            });
            setIsReviewing(false);
            setAbortReview(null);
          },
        },
      );

      setAbortReview(() => abort);
    },
    [selectedPR, addReview, updateReview],
  );

  const handleCancelReview = useCallback(() => {
    if (abortReview) {
      abortReview();
      setIsReviewing(false);
      setAbortReview(null);
    }
  }, [abortReview]);

  const handleMerge = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("merge");
    const result = await mergePullRequest(
      selectedPR.repository.fullName,
      selectedPR.number,
      "squash",
    );
    if (result.success) {
      await fetchPRs();
      setSelectedPR(null);
    }
    setActionLoading(null);
  }, [selectedPR, fetchPRs]);

  const handleClose = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("close");
    const result = await closePullRequest(selectedPR.repository.fullName, selectedPR.number);
    if (result.success) {
      await fetchPRs();
      setSelectedPR(null);
    }
    setActionLoading(null);
  }, [selectedPR, fetchPRs]);

  const handleApprove = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("approve");
    await approvePullRequest(selectedPR.repository.fullName, selectedPR.number);
    fetchPRDetails(selectedPR);
    setActionLoading(null);
  }, [selectedPR, fetchPRDetails]);

  const handleRequestChanges = useCallback(async () => {
    if (!selectedPR) return;
    setActionLoading("changes");
    await requestChanges(
      selectedPR.repository.fullName,
      selectedPR.number,
      "Changes requested via Lyon",
    );
    fetchPRDetails(selectedPR);
    setActionLoading(null);
  }, [selectedPR, fetchPRDetails]);

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
      );

      if (result.success) {
        // Refresh comments after adding
        const commentsResult = await getReviewComments(
          selectedPR.repository.fullName,
          selectedPR.number,
        );
        if (commentsResult.success && commentsResult.data) {
          setCommentsByLine(convertToCommentsByLine(commentsResult.data));
        }
      } else {
        console.error("Failed to add comment:", result.error);
      }
    },
    [selectedPR],
  );

  const totalPRs = Array.from(pullRequests.values()).reduce((sum, prs) => sum + prs.length, 0);

  const filteredUserRepos = userRepos.filter(
    (r) =>
      !watchedRepos.includes(r.fullName) &&
      r.fullName.toLowerCase().includes(repoInput.toLowerCase()),
  );

  const sidebarContent = (
    <Sidebar
      header={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-5 text-primary" />
            <span className="text-lg font-bold">Lyon</span>
          </div>
          <Button variant="ghost" size="icon-sm">
            <Settings className="size-4" />
          </Button>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
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
        ) : (
          <PRList
            repositories={repositories}
            pullRequestsByRepo={pullRequests}
            selectedPR={selectedPR}
            onSelectPR={handleSelectPR}
            isLoading={false}
            onRemoveRepo={handleRemoveRepo}
          />
        )}
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
                <PRActions
                  pr={selectedPR}
                  onMerge={handleMerge}
                  onClose={handleClose}
                  onApprove={handleApprove}
                  onRequestChanges={handleRequestChanges}
                  isLoading={isLoadingPRDetails}
                  loadingAction={
                    actionLoading === "review" ? null : actionLoading as "merge" | "close" | "approve" | "changes" | null
                  }
                />
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
                <PRDetail pr={selectedPR} />

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
                  scrollToLine={scrollToLine}
                  commentsByLine={commentsByLine}
                  onAddComment={handleAddComment}
                />
              </div>

              <div className="flex flex-col gap-6 lg:h-[calc(100vh-10rem)] lg:sticky lg:top-6">
                <AIReviewPanel
                  prNumber={selectedPR.number}
                  repository={selectedPR.repository.fullName}
                  onStartReview={handleStartReview}
                  onCancelReview={handleCancelReview}
                  isLoading={isReviewing}
                  onCommentClick={(filePath, line) => {
                    setSelectedDiffFile(filePath);
                    setScrollToLine(line);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center">
              <GlassCard className="max-w-md p-8 text-center" variant="subtle">
                {isLoading ? (
                  <>
                    <Loader2 className="mx-auto mb-4 size-12 animate-spin text-muted-foreground" />
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
                <ScrollArea orientation="vertical" className="max-h-32">
                  <div className="space-y-1">
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
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Your Repositories
              </label>
              {isLoadingUserRepos ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea orientation="vertical" className="max-h-48">
                  <div className="space-y-1">
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
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowAddRepo(false)}>
                Done
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </AppLayout>
  );
}
