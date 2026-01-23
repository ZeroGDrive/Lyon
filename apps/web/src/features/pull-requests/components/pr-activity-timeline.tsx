import type { Comment, PullRequest, PullRequestReview } from "@/types";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  FileCode,
  GitCommit,
  GitPullRequest,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { memo, useMemo } from "react";
import Markdown from "react-markdown";

import { GlassCard } from "@/components/layout/main-content";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: "review" | "review-comment" | "created" | "merged" | "closed";
  timestamp: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  content?: string | null;
  reviewState?: PullRequestReview["state"];
  // For review comments (inline comments on files)
  path?: string;
  line?: number;
}

interface PRActivityTimelineProps {
  pr: PullRequest;
  comments?: Comment[];
  className?: string;
  onCommentClick?: (path: string, line: number) => void;
}

const reviewStateConfig = {
  APPROVED: {
    icon: CheckCircle,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    label: "approved",
  },
  CHANGES_REQUESTED: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    label: "requested changes",
  },
  COMMENTED: {
    icon: MessageCircle,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    label: "commented",
  },
  DISMISSED: {
    icon: XCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    label: "dismissed review",
  },
  PENDING: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    label: "started a review",
  },
};

function PRActivityTimeline({ pr, comments, className, onCommentClick }: PRActivityTimelineProps) {
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // PR created event
    allEvents.push({
      id: "created",
      type: "created",
      timestamp: pr.createdAt,
      author: pr.author,
    });

    // Reviews
    for (const review of pr.reviews) {
      if (review.state === "PENDING") continue; // Skip pending reviews
      allEvents.push({
        id: `review-${review.id}`,
        type: "review",
        timestamp: review.submittedAt,
        author: review.author,
        content: review.body,
        reviewState: review.state,
      });
    }

    // Review comments (file-specific only)
    if (comments) {
      for (const comment of comments) {
        // Only include comments with both path and line (file-specific)
        if (comment.path && comment.line) {
          allEvents.push({
            id: `review-comment-${comment.id}`,
            type: "review-comment",
            timestamp: comment.createdAt,
            author: comment.author,
            content: comment.body,
            path: comment.path,
            line: comment.line,
          });
        }
      }
    }

    // Merged event
    if (pr.mergedAt) {
      allEvents.push({
        id: "merged",
        type: "merged",
        timestamp: pr.mergedAt,
        author: pr.author, // Note: We don't have the actual merger info
      });
    }

    // Closed event (only if closed without merge)
    if (pr.closedAt && !pr.mergedAt) {
      allEvents.push({
        id: "closed",
        type: "closed",
        timestamp: pr.closedAt,
        author: pr.author, // Note: We don't have the actual closer info
      });
    }

    // Sort by timestamp, newest first
    return allEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [pr, comments]);

  return (
    <GlassCard className={cn("p-4", className)} variant="subtle">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Activity</h3>
      <div className="relative pl-10">
        {/* Timeline line - positioned to the left of content */}
        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-glass-border" />

        <div className="space-y-4">
          {events.map((event) => (
            <TimelineEventItem
              key={event.id}
              event={event}
              onCommentClick={onCommentClick}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

interface TimelineEventItemProps {
  event: TimelineEvent;
  onCommentClick?: (path: string, line: number) => void;
}

const TimelineEventItem = memo(function TimelineEventItem({
  event,
  onCommentClick,
}: TimelineEventItemProps) {
  const timeAgo = formatDistanceToNow(new Date(event.timestamp), {
    addSuffix: true,
  });

  // Icon container positioned absolutely to the left
  const IconWrapper = ({ children, bgColor }: { children: React.ReactNode; bgColor: string }) => (
    <div
      className={cn(
        "absolute -left-10 flex size-7 items-center justify-center rounded-full bg-background",
        bgColor
      )}
    >
      {children}
    </div>
  );

  if (event.type === "created") {
    return (
      <div className="relative">
        <IconWrapper bgColor="bg-primary/10">
          <GitPullRequest className="size-3.5 text-primary" />
        </IconWrapper>
        <p className="text-xs text-muted-foreground pt-1">
          <span className="font-medium text-foreground">{event.author.login}</span>{" "}
          opened this pull request{" "}
          <span className="text-muted-foreground/70">{timeAgo}</span>
        </p>
      </div>
    );
  }

  if (event.type === "merged") {
    return (
      <div className="relative">
        <IconWrapper bgColor="bg-purple-400/10">
          <GitCommit className="size-3.5 text-purple-400" />
        </IconWrapper>
        <p className="text-xs text-muted-foreground pt-1">
          Pull request was <span className="font-medium text-purple-400">merged</span>{" "}
          <span className="text-muted-foreground/70">{timeAgo}</span>
        </p>
      </div>
    );
  }

  if (event.type === "closed") {
    return (
      <div className="relative">
        <IconWrapper bgColor="bg-red-400/10">
          <XCircle className="size-3.5 text-red-400" />
        </IconWrapper>
        <p className="text-xs text-muted-foreground pt-1">
          Pull request was <span className="font-medium text-red-400">closed</span>{" "}
          <span className="text-muted-foreground/70">{timeAgo}</span>
        </p>
      </div>
    );
  }

  if (event.type === "review-comment" && event.path && event.line) {
    const isClickable = !!onCommentClick;
    const fileName = event.path.split("/").pop() ?? event.path;

    return (
      <div className="relative">
        <IconWrapper bgColor="bg-blue-400/10">
          <FileCode className="size-3.5 text-blue-400" />
        </IconWrapper>
        <div>
          <p className="text-xs text-muted-foreground pt-1">
            <span className="font-medium text-foreground">{event.author.login}</span>{" "}
            commented on{" "}
            {isClickable ? (
              <button
                type="button"
                onClick={() => onCommentClick(event.path!, event.line!)}
                className="inline-flex items-center gap-1 font-mono text-blue-400 hover:text-blue-300 hover:underline"
              >
                {fileName}:{event.line}
                <ExternalLink className="size-3" />
              </button>
            ) : (
              <span className="font-mono text-blue-400">{fileName}:{event.line}</span>
            )}{" "}
            <span className="text-muted-foreground/70">{timeAgo}</span>
          </p>
          {event.content && (
            <div
              className={cn(
                "mt-2 rounded-lg border border-glass-border-subtle bg-background/50 p-3",
                isClickable && "cursor-pointer hover:border-blue-400/50 transition-colors"
              )}
              onClick={isClickable ? () => onCommentClick(event.path!, event.line!) : undefined}
            >
              <div className="prose prose-sm prose-invert max-w-none text-xs prose-p:text-muted-foreground">
                <Markdown>{event.content}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "review" && event.reviewState) {
    const config = reviewStateConfig[event.reviewState];
    const Icon = config.icon;

    return (
      <div className="relative">
        <IconWrapper bgColor={config.bgColor}>
          <Icon className={cn("size-3.5", config.color)} />
        </IconWrapper>
        <div>
          <p className="text-xs text-muted-foreground pt-1">
            <span className="font-medium text-foreground">{event.author.login}</span>{" "}
            <span className={config.color}>{config.label}</span>{" "}
            <span className="text-muted-foreground/70">{timeAgo}</span>
          </p>
          {event.content && (
            <div className="mt-2 rounded-lg border border-glass-border-subtle bg-background/50 p-3">
              <div className="prose prose-sm prose-invert max-w-none text-xs prose-p:text-muted-foreground">
                <Markdown>{event.content}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
});

export { PRActivityTimeline };
