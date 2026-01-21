import type { PullRequest } from "@/types";

import {
  CheckCircle,
  Clock,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";

import { GlassCard, PageTitle } from "@/components/layout/main-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PRDetailProps {
  pr: PullRequest;
  onMerge?: () => void;
  onClose?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onStartReview?: () => void;
  isLoading?: boolean;
  loadingAction?: "merge" | "close" | "approve" | "changes" | "review" | null;
}

function PRDetail({
  pr,
  onMerge,
  onClose,
  onApprove,
  onRequestChanges,
  onStartReview,
  isLoading,
  loadingAction,
}: PRDetailProps) {
  const canMerge = pr.mergeable && pr.state === "open" && !pr.draft;
  const anyActionLoading = loadingAction !== null && loadingAction !== undefined;

  const reviewStatusIcon =
    pr.reviewDecision === "APPROVED" ? (
      <CheckCircle className="size-4 text-green-400" />
    ) : pr.reviewDecision === "CHANGES_REQUESTED" ? (
      <XCircle className="size-4 text-red-400" />
    ) : (
      <Clock className="size-4 text-yellow-400" />
    );

  const stateConfig = {
    open: { color: "text-green-400", bgColor: "bg-green-400/10", label: "Open" },
    closed: { color: "text-red-400", bgColor: "bg-red-400/10", label: "Closed" },
    merged: { color: "text-purple-400", bgColor: "bg-purple-400/10", label: "Merged" },
  };

  const currentState = stateConfig[pr.state] ?? stateConfig.open;

  return (
    <div className="space-y-6">
      <PageTitle
        description={`#${pr.number} by ${pr.author.login}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartReview}
              disabled={anyActionLoading || isLoading}
            >
              {loadingAction === "review" && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              AI Review
            </Button>
            {pr.state === "open" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onApprove}
                  disabled={anyActionLoading || isLoading}
                >
                  {loadingAction === "approve" && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestChanges}
                  disabled={anyActionLoading || isLoading}
                >
                  {loadingAction === "changes" && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  Request Changes
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onMerge}
                  disabled={!canMerge || anyActionLoading || isLoading}
                >
                  {loadingAction === "merge" ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <GitMerge className="mr-1.5 size-4" />
                  )}
                  Merge
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onClose}
                  disabled={anyActionLoading || isLoading}
                >
                  {loadingAction === "close" && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                  Close
                </Button>
              </>
            )}
          </div>
        }
      >
        {pr.title}
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                currentState.bgColor,
              )}
            >
              <GitPullRequest className={cn("size-5", currentState.color)} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">State</p>
              <p
                className={cn(
                  "text-xs font-medium capitalize",
                  pr.draft ? "text-muted-foreground" : currentState.color,
                )}
              >
                {pr.draft ? "Draft" : currentState.label}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <GitBranch className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Branch</p>
              <p className="truncate text-xs text-muted-foreground">
                {pr.headRef} → {pr.baseRef}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                pr.reviewDecision === "APPROVED"
                  ? "bg-green-400/10"
                  : pr.reviewDecision === "CHANGES_REQUESTED"
                    ? "bg-red-400/10"
                    : "bg-yellow-400/10",
              )}
            >
              {reviewStatusIcon}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Review</p>
              <p
                className={cn(
                  "text-xs font-medium",
                  pr.reviewDecision === "APPROVED"
                    ? "text-green-400"
                    : pr.reviewDecision === "CHANGES_REQUESTED"
                      ? "text-red-400"
                      : "text-yellow-400",
                )}
              >
                {pr.reviewDecision === "APPROVED"
                  ? "Approved"
                  : pr.reviewDecision === "CHANGES_REQUESTED"
                    ? "Changes Requested"
                    : "Pending Review"}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {(pr.additions > 0 || pr.deletions > 0 || pr.changedFiles > 0) && (
        <GlassCard className="p-4" variant="subtle">
          <div className="flex items-center justify-between border-b border-glass-border-subtle pb-3">
            <h3 className="text-sm font-semibold text-foreground">Changes</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-400">+{pr.additions}</span>
              <span className="text-red-400">-{pr.deletions}</span>
              {pr.changedFiles > 0 && (
                <span className="text-muted-foreground">
                  {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
            {pr.reviews.length > 0 && (
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                {pr.reviews.length} reviews
              </span>
            )}
            {pr.commits > 0 && <span>{pr.commits} commits</span>}
          </div>
        </GlassCard>
      )}

      {pr.body && (
        <GlassCard className="p-4" variant="subtle">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Description</h3>
          <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
            {pr.body}
          </div>
        </GlassCard>
      )}

      {pr.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pr.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export { PRDetail };
