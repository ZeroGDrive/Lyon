import type { PullRequest } from "@/types";

import { open } from "@tauri-apps/plugin-shell";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Check from "lucide-react/dist/esm/icons/check";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Files from "lucide-react/dist/esm/icons/files";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import GitMerge from "lucide-react/dist/esm/icons/git-merge";
import GitPullRequest from "lucide-react/dist/esm/icons/git-pull-request";
import MessageSquareWarning from "lucide-react/dist/esm/icons/message-square-warning";
import X from "lucide-react/dist/esm/icons/x";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Markdown from "react-markdown";
import { useState } from "react";

import { GlassCard } from "@/components/layout/main-content";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PRDetailProps {
  pr: PullRequest;
  isLoading?: boolean;
}

function PRDetail({ pr }: PRDetailProps) {
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
      <div className="flex flex-wrap gap-4">
        <GlassCard className="min-w-[160px] flex-1 p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
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

        <GlassCard className="min-w-[160px] flex-1 p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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

        <GlassCard className="min-w-[160px] flex-1 p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
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
          <GlassCard className="min-w-[160px] flex-1 p-4" variant="subtle">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Files className="size-5 text-primary" />
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
  currentUser?: string | null;
  onMerge?: () => void;
  onClose?: () => void;
  onApprove?: () => void;
  onRequestChanges?: (comment: string) => void;
  isLoading?: boolean;
  loadingAction?: "merge" | "close" | "approve" | "changes" | null;
}

function PRActions({
  pr,
  currentUser,
  onMerge,
  onClose,
  onApprove,
  onRequestChanges,
  isLoading,
  loadingAction,
}: PRActionsProps) {
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesComment, setRequestChangesComment] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // Allow merge when mergeable is true or null (unknown), only block when explicitly false (conflicts)
  const canMerge = pr.mergeable !== false && pr.state === "open" && !pr.draft;
  const anyActionLoading = loadingAction !== null && loadingAction !== undefined;
  // Can't review your own PR on GitHub
  const isOwnPR = currentUser && pr.author.login === currentUser;

  const handleRequestChanges = () => {
    if (requestChangesComment.trim() && onRequestChanges) {
      onRequestChanges(requestChangesComment.trim());
      setRequestChangesComment("");
      setRequestChangesOpen(false);
    }
  };

  const handleClose = () => {
    onClose?.();
    setCloseDialogOpen(false);
  };

  const prUrl = `https://github.com/${pr.repository.fullName}/pull/${pr.number}`;

  const openInGitHub = () => {
    open(prUrl).catch(console.error);
  };

  if (pr.state !== "open") {
    return (
      <Button variant="outline" size="sm" onClick={openInGitHub}>
        <ExternalLink className="mr-1.5 size-4" />
        Open in GitHub
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Open in GitHub */}
      <Button variant="outline" size="sm" onClick={openInGitHub}>
        <ExternalLink className="mr-1.5 size-4" />
        GitHub
      </Button>

      {/* Approve Button - hidden for own PR */}
      {!isOwnPR && (
        <Button
          variant="outline"
          size="sm"
          onClick={onApprove}
          disabled={anyActionLoading || isLoading}
          className="border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400"
        >
          {loadingAction === "approve" ? (
            <Spinner size="sm" className="mr-1.5" />
          ) : (
            <Check className="mr-1.5 size-4" />
          )}
          Approve
        </Button>
      )}

      {/* Request Changes Dialog - hidden for own PR */}
      {!isOwnPR && (
        <Dialog open={requestChangesOpen} onOpenChange={setRequestChangesOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={anyActionLoading || isLoading}
                className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
              />
            }
          >
            {loadingAction === "changes" ? (
              <Spinner size="sm" className="mr-1.5" />
            ) : (
              <MessageSquareWarning className="mr-1.5 size-4" />
            )}
            Request Changes
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request Changes</DialogTitle>
              <DialogDescription>
                Explain what changes are needed before this PR can be approved.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Describe the changes you'd like to see..."
              value={requestChangesComment}
              onChange={(e) => setRequestChangesComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestChangesOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestChanges}
                disabled={!requestChangesComment.trim()}
                className="bg-yellow-600 text-white hover:bg-yellow-700"
              >
                <MessageSquareWarning className="mr-1.5 size-4" />
                Request Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Merge Button */}
      <Button
        size="sm"
        onClick={onMerge}
        disabled={!canMerge || anyActionLoading || isLoading}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {loadingAction === "merge" ? (
          <Spinner size="sm" className="mr-1.5" />
        ) : (
          <GitMerge className="mr-1.5 size-4" />
        )}
        Merge
      </Button>

      {/* Close Alert Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={anyActionLoading || isLoading}
              className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
            />
          }
        >
          {loadingAction === "close" ? (
            <Spinner size="sm" className="mr-1.5" />
          ) : (
            <X className="mr-1.5 size-4" />
          )}
          Close
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Close Pull Request?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this pull request? This will mark it as closed without
              merging. You can reopen it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="mr-1.5 size-4" />
              Close PR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { PRActions, PRDetail };
