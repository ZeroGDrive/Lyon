import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Check from "lucide-react/dist/esm/icons/check";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import MessageSquareWarning from "lucide-react/dist/esm/icons/message-square-warning";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { Textarea } from "@/components/ui/textarea";

interface PendingReviewBannerProps {
  onSubmit: (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT", body: string) => void;
  onDiscard: () => void;
  isLoading?: boolean;
  loadingAction?: string | null;
  isOwnPR?: boolean;
  initialBody?: string | null;
}

function PendingReviewBanner({
  onSubmit,
  onDiscard,
  isLoading,
  loadingAction,
  isOwnPR,
  initialBody,
}: PendingReviewBannerProps) {
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [reviewBody, setReviewBody] = useState(initialBody ?? "");

  const isSubmitting = loadingAction === "submit-review";
  const isDiscarding = loadingAction === "discard-review";
  const anyLoading = isLoading || isSubmitting || isDiscarding;
  const cannotReview = Boolean(isOwnPR);
  const bodyTrimmed = reviewBody.trim();

  const handleDiscard = () => {
    onDiscard();
    setDiscardDialogOpen(false);
  };

  useEffect(() => {
    setReviewBody(initialBody ?? "");
  }, [initialBody]);

  return (
    <div className="glass-subtle space-y-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-yellow-500/10">
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">You have a pending review</p>
            <p className="text-xs text-muted-foreground">
              New comments will be added to this review until you submit or discard it
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Submit as Comment */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSubmit("COMMENT", bodyTrimmed)}
            disabled={anyLoading}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            {isSubmitting ? (
              <Spinner size="sm" className="mr-1.5" />
            ) : (
              <MessageSquare className="mr-1.5 size-4" />
            )}
            Submit as Comment
          </Button>

          {/* Submit with Request Changes */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSubmit("REQUEST_CHANGES", bodyTrimmed)}
            disabled={anyLoading || cannotReview || bodyTrimmed.length === 0}
            className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
            title={
              cannotReview
                ? "You can't request changes on your own pull request."
                : bodyTrimmed.length === 0
                  ? "Add a summary before requesting changes."
                  : undefined
            }
          >
            {isSubmitting ? (
              <Spinner size="sm" className="mr-1.5" />
            ) : (
              <MessageSquareWarning className="mr-1.5 size-4" />
            )}
            Request Changes
          </Button>

          {/* Submit with Approval */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSubmit("APPROVE", bodyTrimmed)}
            disabled={anyLoading || cannotReview}
            className="border-green-500/30 text-green-500 hover:bg-green-500/10"
            title={cannotReview ? "You can't approve your own pull request." : undefined}
          >
            {isSubmitting ? (
              <Spinner size="sm" className="mr-1.5" />
            ) : (
              <Check className="mr-1.5 size-4" />
            )}
            Approve
          </Button>

          {/* Discard */}
          <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={anyLoading}
                  className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                />
              }
            >
              {isDiscarding ? (
                <Spinner size="sm" className="mr-1.5" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              Discard
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  Discard Pending Review?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete your pending review and all its comments. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDiscard}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Discard Review
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Review summary (optional)
        </label>
        <Textarea
          value={reviewBody}
          onChange={(e) => setReviewBody(e.target.value)}
          placeholder="Summarize your review for the PR author..."
          rows={3}
          className="resize-none"
          disabled={anyLoading}
        />
      </div>
    </div>
  );
}

export { PendingReviewBanner };
