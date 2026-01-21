import type { Comment } from "@/types";

import { formatDistanceToNow } from "date-fns";
import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";

interface CommentThreadProps {
  comments: Comment[];
  className?: string;
}

function CommentThread({ comments, className }: CommentThreadProps) {
  if (comments.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  isAIGenerated?: boolean;
}

function CommentItem({ comment, isAIGenerated }: CommentItemProps) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0">
        {isAIGenerated ? (
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
            <Bot className="size-4 text-primary" />
          </div>
        ) : (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.login}
            className="size-8 rounded-full"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{comment.author.login}</span>
          {isAIGenerated && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              AI
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        <div className="mt-1 text-sm text-foreground/80">{comment.body}</div>

        {comment.path && (
          <div className="mt-2 text-xs text-muted-foreground">
            on{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              {comment.path}
              {comment.line && `:${comment.line}`}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

export { CommentThread, CommentItem };
