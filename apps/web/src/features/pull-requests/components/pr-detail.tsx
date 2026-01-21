import type { PullRequest } from "@/types";

import {
  CheckCircle,
  Clock,
  Files,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  XCircle,
} from "lucide-react";
import Markdown from "react-markdown";

import { GlassCard } from "@/components/layout/main-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PRDetailProps {
  pr: PullRequest;
  isLoading?: boolean;
}

function PRDetail({ pr, isLoading }: PRDetailProps) {
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

        {(pr.additions > 0 || pr.deletions > 0 || pr.changedFiles > 0) && (
          <GlassCard className="p-4" variant="subtle">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-400/10">
                <Files className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Changes</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-400">+{pr.additions}</span>{" "}
                  <span className="text-red-400">-{pr.deletions}</span>{" "}
                  <span className="text-muted-foreground/70">({pr.changedFiles} files)</span>
                </p>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      {pr.body && (
        <GlassCard className="p-4" variant="subtle">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Description</h3>
          <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-foreground prose-pre:bg-muted prose-li:text-muted-foreground">
            <Markdown>{pr.body}</Markdown>
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

interface PRActionsProps {
  pr: PullRequest;
  onMerge?: () => void;
  onClose?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  isLoading?: boolean;
  loadingAction?: "merge" | "close" | "approve" | "changes" | null;
}

function PRActions({
  pr,
  onMerge,
  onClose,
  onApprove,
  onRequestChanges,
  isLoading,
  loadingAction,
}: PRActionsProps) {
  const canMerge = pr.mergeable && pr.state === "open" && !pr.draft;
  const anyActionLoading = loadingAction !== null && loadingAction !== undefined;

  if (pr.state !== "open") return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onApprove}
        disabled={anyActionLoading || isLoading}
      >
        {loadingAction === "approve" && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRequestChanges}
        disabled={anyActionLoading || isLoading}
      >
        {loadingAction === "changes" && <Loader2 className="mr-1.5 size-4 animate-spin" />}
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
    </div>
  );
}

export { PRActions, PRDetail };
