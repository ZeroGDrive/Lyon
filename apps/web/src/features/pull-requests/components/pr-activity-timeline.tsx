import type { Comment, PullRequest, PullRequestReview } from "@/types";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Clock,
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
  type: "review" | "comment" | "created" | "merged" | "closed";
  timestamp: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  content?: string | null;
  reviewState?: PullRequestReview["state"];
}

interface PRActivityTimelineProps {
  pr: PullRequest;
  comments?: Comment[];
  className?: string;
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

function PRActivityTimeline({ pr, comments, className }: PRActivityTimelineProps) {
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

    // Comments (if provided)
    if (comments) {
      for (const comment of comments) {
        // Skip review comments (they have a path)
        if (comment.path) continue;
        allEvents.push({
          id: `comment-${comment.id}`,
          type: "comment",
          timestamp: comment.createdAt,
          author: comment.author,
          content: comment.body,
        });
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
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-glass-border" />

        <div className="space-y-4">
          {events.map((event) => (
            <TimelineEventItem key={event.id} event={event} />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

interface TimelineEventItemProps {
  event: TimelineEvent;
}

const TimelineEventItem = memo(function TimelineEventItem({
  event,
}: TimelineEventItemProps) {
  const timeAgo = formatDistanceToNow(new Date(event.timestamp), {
    addSuffix: true,
  });

  if (event.type === "created") {
    return (
      <div className="relative flex gap-3 pl-1">
        <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <GitPullRequest className="size-3.5 text-primary" />
        </div>
        <div className="flex-1 pt-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{event.author.login}</span>{" "}
            opened this pull request{" "}
            <span className="text-muted-foreground/70">{timeAgo}</span>
          </p>
        </div>
      </div>
    );
  }

  if (event.type === "merged") {
    return (
      <div className="relative flex gap-3 pl-1">
        <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-400/10">
          <GitCommit className="size-3.5 text-purple-400" />
        </div>
        <div className="flex-1 pt-0.5">
          <p className="text-xs text-muted-foreground">
            Pull request was <span className="font-medium text-purple-400">merged</span>{" "}
            <span className="text-muted-foreground/70">{timeAgo}</span>
          </p>
        </div>
      </div>
    );
  }

  if (event.type === "closed") {
    return (
      <div className="relative flex gap-3 pl-1">
        <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-red-400/10">
          <XCircle className="size-3.5 text-red-400" />
        </div>
        <div className="flex-1 pt-0.5">
          <p className="text-xs text-muted-foreground">
            Pull request was <span className="font-medium text-red-400">closed</span>{" "}
            <span className="text-muted-foreground/70">{timeAgo}</span>
          </p>
        </div>
      </div>
    );
  }

  if (event.type === "comment") {
    return (
      <div className="relative flex gap-3 pl-1">
        <img
          src={event.author.avatarUrl}
          alt={event.author.login}
          className="relative z-10 size-7 shrink-0 rounded-full"
        />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{event.author.login}</span>{" "}
            commented{" "}
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

  if (event.type === "review" && event.reviewState) {
    const config = reviewStateConfig[event.reviewState];
    const Icon = config.icon;

    return (
      <div className="relative flex gap-3 pl-1">
        <div
          className={cn(
            "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
            config.bgColor
          )}
        >
          <Icon className={cn("size-3.5", config.color)} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
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
