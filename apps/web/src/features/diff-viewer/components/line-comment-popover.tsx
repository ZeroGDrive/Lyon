import type { LineComment } from "@/types";

import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquare, Send } from "lucide-react";
import { memo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LineCommentPopoverProps {
  lineNumber: number | null;
  side: "LEFT" | "RIGHT";
  comments: LineComment[];
  onAddComment?: (body: string) => void | Promise<void>;
  className?: string;
  lineType?: "addition" | "deletion" | "context";
}

const LineCommentPopover = memo(function LineCommentPopover({
  lineNumber,
  side,
  comments,
  onAddComment,
  className,
  lineType,
}: LineCommentPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasComments = comments.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentValue.trim() || !onAddComment) return;

    setIsSubmitting(true);
    try {
      await Promise.resolve(onAddComment(commentValue.trim()));
      setCommentValue("");
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (lineNumber === null) {
    return (
      <div
        className={cn(
          "flex w-12 shrink-0 select-none items-center justify-end px-2",
          "border-r border-glass-border-subtle",
          className,
        )}
      />
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(
          "group/trigger relative flex h-full w-12 shrink-0 select-none items-center justify-end px-2",
          "border-r border-glass-border-subtle transition-colors",
          lineType === "addition"
            ? "bg-green-950 text-green-500/70"
            : lineType === "deletion"
              ? "bg-red-950 text-red-500/70"
              : "bg-background text-muted-foreground/50",
          "hover:bg-primary/10",
          hasComments && "text-primary",
          className,
        )}
      >
        <span className={cn("group-hover/trigger:hidden", hasComments && "hidden")}>
          {lineNumber}
        </span>
        <MessageSquare
          className={cn(
            "absolute size-3.5 text-primary",
            hasComments ? "opacity-100" : "opacity-0 group-hover/trigger:opacity-100",
          )}
        />
        {hasComments && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {comments.length}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        side={side === "LEFT" ? "left" : "right"}
        align="start"
        sideOffset={8}
        className="w-80 rounded-lg border border-glass-border bg-popover p-0 shadow-xl"
      >
        <div className="border-b border-glass-border-subtle px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="size-3.5" />
            <span>
              Comments on line {lineNumber} ({side === "LEFT" ? "old" : "new"})
            </span>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {hasComments ? (
            <div className="divide-y divide-glass-border-subtle">
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">No comments yet</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-glass-border-subtle p-3">
          <textarea
            value={commentValue}
            onChange={(e) => setCommentValue(e.target.value)}
            placeholder="Add a comment..."
            disabled={isSubmitting || !onAddComment}
            rows={2}
            className={cn(
              "w-full resize-none rounded-md border border-glass-border bg-background p-2",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
                ? "⌘"
                : "Ctrl"}{" "}
              + Enter to submit
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!commentValue.trim() || isSubmitting || !onAddComment}
              className="h-7 px-2 text-xs"
            >
              <Send className="mr-1 size-3" />
              Comment
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
});

interface CommentItemProps {
  comment: LineComment;
}

const CommentItem = memo(function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="flex gap-2 p-3">
      <div className="shrink-0">
        {comment.isAIGenerated ? (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
            <Bot className="size-3 text-primary" />
          </div>
        ) : (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.login}
            className="size-6 rounded-full"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{comment.author.login}</span>
          {comment.isAIGenerated && (
            <span className="rounded-full bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
              AI
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">{comment.body}</p>
      </div>
    </div>
  );
});

export { LineCommentPopover };
