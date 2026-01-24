import type { LineComment } from "@/types";

import { formatDistanceToNow } from "date-fns";
import Bot from "lucide-react/dist/esm/icons/bot";
import Check from "lucide-react/dist/esm/icons/check";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Send from "lucide-react/dist/esm/icons/send";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { memo, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LineCommentPopoverProps {
  lineNumber: number | null;
  side: "LEFT" | "RIGHT";
  comments: LineComment[];
  onAddComment?: (body: string) => void | Promise<void>;
  className?: string;
  lineType?: "addition" | "deletion" | "context";
  currentUser?: string | null;
  onReply?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}

const LineCommentPopover = memo(function LineCommentPopover({
  lineNumber,
  side,
  comments,
  onAddComment,
  className,
  lineType,
  currentUser,
  onReply,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: LineCommentPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

  const hasComments = comments.length > 0;
  const threadId = comments[0]?.threadId;
  const threadResolved = comments[0]?.threadResolved;

  const replyTarget = useMemo(() => {
    if (!replyToId) return null;
    return comments.find((comment) => comment.commentId === replyToId) ?? null;
  }, [comments, replyToId]);

  useEffect(() => {
    if (!isOpen) {
      setReplyToId(null);
      setEditingCommentId(null);
      setEditValue("");
      setCommentValue("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentValue.trim()) return;

    setIsSubmitting(true);
    try {
      if (replyToId && onReply) {
        await Promise.resolve(onReply(replyToId, commentValue.trim()));
      } else if (onAddComment) {
        await Promise.resolve(onAddComment(commentValue.trim()));
      }
      setCommentValue("");
      setReplyToId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (comment: LineComment) => {
    if (!comment.commentId) return;
    setEditingCommentId(comment.commentId);
    setEditValue(comment.body);
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId || !onEditComment || !editValue.trim()) return;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onEditComment(editingCommentId, editValue.trim()));
      setEditingCommentId(null);
      setEditValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!onDeleteComment) return;
    setDeletingCommentId(commentId);
    try {
      await Promise.resolve(onDeleteComment(commentId));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleResolveToggle = async () => {
    if (!threadId) return;
    setIsResolving(true);
    try {
      if (threadResolved) {
        await Promise.resolve(onUnresolveThread?.(threadId));
      } else {
        await Promise.resolve(onResolveThread?.(threadId));
      }
    } finally {
      setIsResolving(false);
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
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-3.5" />
              <span>
                Comments on line {lineNumber} ({side === "LEFT" ? "old" : "new"})
              </span>
              {threadResolved && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                  Resolved
                </span>
              )}
            </div>
            {threadId && (onResolveThread || onUnresolveThread) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResolveToggle}
                disabled={isResolving}
                className="h-6 px-2 text-[10px]"
              >
                {isResolving ? (
                  <Spinner size="xs" className="mr-1 size-3" />
                ) : (
                  <Check className="mr-1 size-3" />
                )}
                {threadResolved ? "Unresolve" : "Resolve"}
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {hasComments ? (
            <div className="divide-y divide-glass-border-subtle">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  isEditing={editingCommentId === comment.commentId}
                  editValue={editValue}
                  onEditValueChange={setEditValue}
                  onEditStart={() => handleStartEdit(comment)}
                  onEditCancel={() => {
                    setEditingCommentId(null);
                    setEditValue("");
                  }}
                  onEditSave={handleSaveEdit}
                  onReply={() => {
                    if (comment.commentId) {
                      setReplyToId(comment.commentId);
                    }
                  }}
                  onDelete={comment.commentId ? () => handleDelete(comment.commentId!) : undefined}
                  isDeleting={deletingCommentId === comment.commentId}
                  isSubmitting={isSubmitting}
                />
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
          {replyTarget && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-primary/5 px-2 py-1 text-[10px] text-primary">
              <span>Replying to {replyTarget.author.login}</span>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={commentValue}
            onChange={(e) => setCommentValue(e.target.value)}
            placeholder={replyToId ? "Write a reply..." : "Add a comment..."}
            disabled={isSubmitting || (!onAddComment && !onReply)}
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
              disabled={!commentValue.trim() || isSubmitting || (!onAddComment && !onReply)}
              className="h-7 px-2 text-xs"
            >
              {isSubmitting ? (
                <Spinner size="xs" className="mr-1 size-3" />
              ) : (
                <Send className="mr-1 size-3" />
              )}
              {isSubmitting ? "Sending..." : "Comment"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
});

interface CommentItemProps {
  comment: LineComment;
  currentUser?: string | null;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onEditStart?: () => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  isSubmitting?: boolean;
}

const CommentItem = memo(function CommentItem({
  comment,
  currentUser,
  isEditing,
  editValue,
  onEditValueChange,
  onEditStart,
  onEditCancel,
  onEditSave,
  onReply,
  onDelete,
  isDeleting,
  isSubmitting,
}: CommentItemProps) {
  const canEdit =
    comment.viewerDidAuthor ?? (currentUser ? comment.author.login === currentUser : false);

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
          {comment.isPending && (
            <span className="rounded-full bg-yellow-500/10 px-1 py-0.5 text-[9px] font-medium text-yellow-500">
              Draft
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editValue ?? ""}
              onChange={(e) => onEditValueChange?.(e.target.value)}
              rows={3}
              className={cn(
                "w-full resize-none rounded-md border border-glass-border bg-background p-2",
                "text-xs text-foreground placeholder:text-muted-foreground",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50",
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={onEditSave}
                disabled={!editValue?.trim() || isSubmitting}
                className="h-6 px-2 text-[10px]"
              >
                {isSubmitting ? (
                  <Spinner size="xs" className="mr-1 size-3" />
                ) : (
                  <Check className="mr-1 size-3" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onEditCancel}
                className="h-6 px-2 text-[10px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">{comment.body}</p>
        )}

        {!isEditing && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            {onReply && comment.commentId && (
              <button
                type="button"
                onClick={onReply}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <MessageSquare className="size-3" />
                Reply
              </button>
            )}
            {canEdit && onEditStart && (
              <button
                type="button"
                onClick={onEditStart}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            )}
            {canEdit && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 hover:text-foreground disabled:opacity-50"
              >
                {isDeleting ? (
                  <Spinner size="xs" className="size-3" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export { LineCommentPopover };
