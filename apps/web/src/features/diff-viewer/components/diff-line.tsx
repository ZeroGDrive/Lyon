import type { DiffLine as DiffLineType, LineComment, LineType } from "@/types";

import { MessageSquarePlus } from "lucide-react";

import { cn } from "@/lib/utils";

interface DiffLineProps {
  line: DiffLineType;
  filePath: string;
  comments?: LineComment[];
  onAddComment?: (lineNumber: number, side: "LEFT" | "RIGHT") => void;
}

const lineTypeStyles: Record<LineType, string> = {
  addition: "bg-green-500/10 hover:bg-green-500/20",
  deletion: "bg-red-500/10 hover:bg-red-500/20",
  context: "hover:bg-glass-highlight",
  "hunk-header": "bg-primary/5 text-muted-foreground italic",
};

const lineNumberStyles: Record<LineType, string> = {
  addition: "text-green-500/70",
  deletion: "text-red-500/70",
  context: "text-muted-foreground/50",
  "hunk-header": "text-muted-foreground/30",
};

const contentPrefixStyles: Record<LineType, string> = {
  addition: "text-green-400",
  deletion: "text-red-400",
  context: "text-muted-foreground/40",
  "hunk-header": "text-muted-foreground/60",
};

function DiffLine({ line, filePath: _filePath, comments = [], onAddComment }: DiffLineProps) {
  const { type, content, oldLineNumber, newLineNumber } = line;
  const hasComments = comments.length > 0;

  const prefix = type === "addition" ? "+" : type === "deletion" ? "-" : " ";
  const displayContent = type === "hunk-header" ? content : content.slice(1);

  const handleLineClick = (side: "LEFT" | "RIGHT") => {
    const lineNum = side === "LEFT" ? oldLineNumber : newLineNumber;
    if (lineNum !== null && onAddComment) {
      onAddComment(lineNum, side);
    }
  };

  return (
    <div data-slot="diff-line" className="group/line">
      <div
        className={cn(
          "flex items-stretch font-mono text-xs leading-6 transition-colors duration-150",
          lineTypeStyles[type],
          hasComments && "ring-1 ring-inset ring-primary/20",
        )}
      >
        <button
          type="button"
          onClick={() => handleLineClick("LEFT")}
          disabled={oldLineNumber === null || !onAddComment}
          className={cn(
            "relative flex w-12 shrink-0 select-none items-center justify-end px-2",
            "border-r border-glass-border-subtle",
            "transition-colors duration-150",
            lineNumberStyles[type],
            oldLineNumber !== null &&
              onAddComment && [
                "cursor-pointer hover:bg-primary/10",
                "group-hover/line:text-primary/70",
              ],
          )}
        >
          {oldLineNumber !== null && (
            <>
              <span className="group-hover/line:opacity-0 transition-opacity duration-150">
                {oldLineNumber}
              </span>
              {onAddComment && (
                <MessageSquarePlus className="absolute size-3.5 opacity-0 group-hover/line:opacity-100 transition-opacity duration-150 text-primary" />
              )}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleLineClick("RIGHT")}
          disabled={newLineNumber === null || !onAddComment}
          className={cn(
            "relative flex w-12 shrink-0 select-none items-center justify-end px-2",
            "border-r border-glass-border-subtle",
            "transition-colors duration-150",
            lineNumberStyles[type],
            newLineNumber !== null &&
              onAddComment && [
                "cursor-pointer hover:bg-primary/10",
                "group-hover/line:text-primary/70",
              ],
          )}
        >
          {newLineNumber !== null && (
            <>
              <span className="group-hover/line:opacity-0 transition-opacity duration-150">
                {newLineNumber}
              </span>
              {onAddComment && (
                <MessageSquarePlus className="absolute size-3.5 opacity-0 group-hover/line:opacity-100 transition-opacity duration-150 text-primary" />
              )}
            </>
          )}
        </button>

        <div className="flex-1 px-3 whitespace-pre">
          {type !== "hunk-header" && (
            <span className={cn("select-none mr-1", contentPrefixStyles[type])}>{prefix}</span>
          )}
          <span
            className={cn(
              type === "addition" && "text-green-300",
              type === "deletion" && "text-red-300",
              type === "context" && "text-foreground/80",
              type === "hunk-header" && "text-muted-foreground",
            )}
          >
            {displayContent}
          </span>
        </div>
      </div>

      {hasComments && (
        <div className="border-l-2 border-primary/30 bg-primary/5 ml-24">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 px-4 py-3">
              <img
                src={comment.author.avatarUrl}
                alt={comment.author.login}
                className="size-6 rounded-full ring-1 ring-glass-border shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{comment.author.login}</span>
                  {comment.isAIGenerated && (
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      AI
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/80 leading-relaxed">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { DiffLine };
