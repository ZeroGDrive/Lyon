import type { LineComment } from "@/types";

import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";

import { LineCommentPopover } from "./line-comment-popover";

interface LineGutterProps {
  lineNumber: number | null;
  side: "LEFT" | "RIGHT";
  comments: LineComment[];
  onAddComment?: (body: string) => void;
  lineType?: "addition" | "deletion" | "context";
  currentUser?: string | null;
  onReply?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}

const LineGutter = memo(function LineGutter({
  lineNumber,
  side,
  comments,
  onAddComment,
  lineType,
  currentUser,
  onReply,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: LineGutterProps) {
  const [showPopover, setShowPopover] = useState(false);
  const hasComments = comments.length > 0;

  if (lineNumber === null) {
    return (
      <div
        className={cn(
          "flex w-12 shrink-0 select-none items-center justify-end px-2",
          "border-r border-glass-border-subtle",
        )}
      />
    );
  }

  if (hasComments || showPopover) {
    return (
      <LineCommentPopover
        lineNumber={lineNumber}
        side={side}
        comments={comments}
        onAddComment={onAddComment}
        lineType={lineType}
        currentUser={currentUser}
        onReply={onReply}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onResolveThread={onResolveThread}
        onUnresolveThread={onUnresolveThread}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowPopover(true)}
      className={cn(
        "group/gutter relative flex h-full w-12 shrink-0 select-none items-center justify-end px-2",
        "border-r border-glass-border-subtle transition-colors",
        lineType === "addition"
          ? "bg-green-950 text-green-500/70"
          : lineType === "deletion"
            ? "bg-red-950 text-red-500/70"
            : "bg-background text-muted-foreground/50",
        onAddComment && "hover:bg-primary/10 cursor-pointer",
      )}
    >
      <span className="group-hover/gutter:hidden">{lineNumber}</span>
      {onAddComment && (
        <MessageSquare className="absolute size-3.5 text-primary opacity-0 group-hover/gutter:opacity-100" />
      )}
    </button>
  );
});

export { LineGutter };
