import type { CommentsByLine, DiffHunk as DiffHunkType } from "@/types";

import { cn } from "@/lib/utils";

import { DiffLine } from "./diff-line";

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath: string;
  hunkIndex: number;
  commentsByLine?: CommentsByLine;
  onAddComment?: (lineNumber: number, side: "LEFT" | "RIGHT") => void;
}

function getCommentKey(filePath: string, line: number, side: "LEFT" | "RIGHT"): string {
  return `${filePath}:${line}:${side}`;
}

function DiffHunk({ hunk, filePath, hunkIndex, commentsByLine, onAddComment }: DiffHunkProps) {
  const getCommentsForLine = (lineIndex: number) => {
    const line = hunk.lines[lineIndex];
    if (!line) return [];

    const leftKey =
      line.oldLineNumber !== null ? getCommentKey(filePath, line.oldLineNumber, "LEFT") : null;
    const rightKey =
      line.newLineNumber !== null ? getCommentKey(filePath, line.newLineNumber, "RIGHT") : null;

    return [
      ...(leftKey && commentsByLine?.get(leftKey) ? commentsByLine.get(leftKey)! : []),
      ...(rightKey && commentsByLine?.get(rightKey) ? commentsByLine.get(rightKey)! : []),
    ];
  };

  return (
    <div
      data-slot="diff-hunk"
      className={cn("border-t border-glass-border-subtle", hunkIndex === 0 && "border-t-0")}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-muted/80 px-4 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur-sm">
        <span className="shrink-0 text-primary/60">@@</span>
        <span>{hunk.header}</span>
        <span className="shrink-0 text-primary/60">@@</span>
      </div>

      <div>
        {hunk.lines.map((line, lineIndex) => (
          <DiffLine
            key={`${hunkIndex}-${lineIndex}`}
            line={line}
            filePath={filePath}
            comments={getCommentsForLine(lineIndex)}
            onAddComment={onAddComment}
          />
        ))}
      </div>
    </div>
  );
}

export { DiffHunk };
