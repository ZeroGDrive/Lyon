import { AlertTriangle, Check, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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

interface PendingReviewBannerProps {
  onSubmit: (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") => void;
  onDiscard: () => void;
  isLoading?: boolean;
  loadingAction?: string | null;
  isOwnPR?: boolean;
}

function PendingReviewBanner({
  onSubmit,
  onDiscard,
  isLoading,
  loadingAction,
  isOwnPR,
}: PendingReviewBannerProps) {
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  const isSubmitting = loadingAction === "submit-review";
  const isDiscarding = loadingAction === "discard-review";
  const anyLoading = isLoading || isSubmitting || isDiscarding;
  const cannotApprove = Boolean(isOwnPR);

  const handleDiscard = () => {
    onDiscard();
    setDiscardDialogOpen(false);
  };

  return (
    <div className="glass-subtle flex items-center justify-between gap-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
      <div className="flex items-center gap-3">
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

      <div className="flex items-center gap-2">
        {/* Submit as Comment */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSubmit("COMMENT")}
          disabled={anyLoading}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          {isSubmitting ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <MessageSquare className="mr-1.5 size-4" />
          )}
          Submit as Comment
        </Button>

        {/* Submit with Approval */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSubmit("APPROVE")}
          disabled={anyLoading || cannotApprove}
          className="border-green-500/30 text-green-500 hover:bg-green-500/10"
          title={cannotApprove ? "You can't approve your own pull request." : undefined}
        >
          {isSubmitting ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
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
              <Loader2 className="mr-1.5 size-4 animate-spin" />
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
                This will delete your pending review and all its comments. This action cannot be undone.
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
  );
}

export { PendingReviewBanner };
