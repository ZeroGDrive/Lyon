import type { CommentsByLine, DiffHunk, DiffLine, FileDiff, LineComment } from "@/types";

import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { highlightLinesWithCache, type HighlightedToken } from "@/lib/syntax-highlighter";
import { LineGutter } from "./line-gutter";

interface SideBySideDiffProps {
  file: FileDiff;
  commentsByLine?: CommentsByLine;
  onAddComment?: (
    filePath: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT",
    body: string,
  ) => void;
  searchQuery?: string;
  currentUser?: string | null;
  onReplyComment?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
  scrollToLine?: number | null;
  disableVirtualization?: boolean;
}

interface AlignedLine {
  left: DiffLine | null;
  right: DiffLine | null;
  isHunkHeader?: boolean;
  hunkHeader?: string;
}

function alignHunkLines(hunks: DiffHunk[]): AlignedLine[] {
  const aligned: AlignedLine[] = [];

  for (const hunk of hunks) {
    aligned.push({
      left: null,
      right: null,
      isHunkHeader: true,
      hunkHeader: hunk.header,
    });

    const lines = hunk.lines.filter((l) => l.type !== "hunk-header");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.type === "context") {
        aligned.push({ left: line, right: line });
        i++;
      } else if (line.type === "deletion") {
        const deletions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "deletion") {
          deletions.push(lines[i]);
          i++;
        }
        const additions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "addition") {
          additions.push(lines[i]);
          i++;
        }
        const maxLen = Math.max(deletions.length, additions.length);
        for (let j = 0; j < maxLen; j++) {
          aligned.push({
            left: deletions[j] ?? null,
            right: additions[j] ?? null,
          });
        }
      } else if (line.type === "addition") {
        aligned.push({ left: null, right: line });
        i++;
      } else {
        i++;
      }
    }
  }

  return aligned;
}

const LINE_HEIGHT = 24;

function SideBySideDiff({
  file,
  commentsByLine,
  onAddComment,
  searchQuery,
  currentUser,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
  scrollToLine,
  disableVirtualization,
}: SideBySideDiffProps) {
  const [highlightedTokens, setHighlightedTokens] = useState<Map<string, HighlightedToken[]>>(
    new Map(),
  );
  const parentRef = useRef<HTMLDivElement>(null);

  const alignedLines = useMemo(() => alignHunkLines(file.hunks), [file.hunks]);

  const dynamicOverscan = alignedLines.length > 500 ? 10 : 30;

  const virtualizer = useVirtualizer({
    count: alignedLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: dynamicOverscan,
  });

  const getCommentsForLine = useCallback(
    (lineNumber: number, side: "LEFT" | "RIGHT"): LineComment[] => {
      if (!commentsByLine) return [];
      const key = `${file.path}:${lineNumber}:${side}`;
      return commentsByLine.get(key) ?? [];
    },
    [commentsByLine, file.path],
  );

  const handleAddComment = useCallback(
    (lineNumber: number, side: "LEFT" | "RIGHT", body: string) => {
      return onAddComment?.(file.path, lineNumber, side, body);
    },
    [onAddComment, file.path],
  );

  useEffect(() => {
    const allLines: { content: string; key: string }[] = [];

    alignedLines.forEach((aligned, index) => {
      if (aligned.left && !aligned.isHunkHeader) {
        allLines.push({ content: aligned.left.content, key: `left-${index}` });
      }
      if (aligned.right && !aligned.isHunkHeader && aligned.right !== aligned.left) {
        allLines.push({ content: aligned.right.content, key: `right-${index}` });
      }
    });

    if (allLines.length === 0) return;

    highlightLinesWithCache(
      allLines.map((l) => l.content),
      file.path,
    ).then((tokens) => {
      const map = new Map<string, HighlightedToken[]>();
      tokens.forEach((t, i) => {
        const lineInfo = allLines[i];
        if (lineInfo) {
          map.set(lineInfo.key, t);
        }
      });
      setHighlightedTokens(map);
    });
  }, [alignedLines, file.path]);

  useEffect(() => {
    if (scrollToLine === null || scrollToLine === undefined) return;

    const targetIndex = alignedLines.findIndex(
      (item) =>
        !item.isHunkHeader &&
        (item.left?.newLineNumber === scrollToLine ||
          item.left?.oldLineNumber === scrollToLine ||
          item.right?.newLineNumber === scrollToLine ||
          item.right?.oldLineNumber === scrollToLine),
    );

    if (targetIndex !== -1) {
      virtualizer.scrollToIndex(targetIndex, { align: "center" });
    }
  }, [scrollToLine, alignedLines, virtualizer]);

  if (file.binary) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Binary file not shown
      </div>
    );
  }

  if (alignedLines.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No changes to display
      </div>
    );
  }

  if (disableVirtualization) {
    return (
      <div className="flex bg-background/30">
        <div className="w-1/2 min-w-0 overflow-x-auto border-r border-glass-border">
          <div className="min-w-max">
            {alignedLines.map((aligned, index) => (
              <LeftLine
                key={`left-${index}`}
                aligned={aligned}
                tokens={highlightedTokens.get(`left-${index}`)}
                comments={
                  aligned.left?.oldLineNumber
                    ? getCommentsForLine(aligned.left.oldLineNumber, "LEFT")
                    : []
                }
                onAddComment={
                  onAddComment && aligned.left?.oldLineNumber
                    ? (body) => handleAddComment(aligned.left!.oldLineNumber!, "LEFT", body)
                    : undefined
                }
                searchQuery={searchQuery}
                currentUser={currentUser}
                onReplyComment={onReplyComment}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onResolveThread={onResolveThread}
                onUnresolveThread={onUnresolveThread}
              />
            ))}
          </div>
        </div>
        <div className="w-1/2 min-w-0 overflow-x-auto">
          <div className="min-w-max">
            {alignedLines.map((aligned, index) => (
              <RightLine
                key={`right-${index}`}
                aligned={aligned}
                tokens={
                  aligned.left === aligned.right
                    ? highlightedTokens.get(`left-${index}`)
                    : highlightedTokens.get(`right-${index}`)
                }
                comments={
                  aligned.right?.newLineNumber
                    ? getCommentsForLine(aligned.right.newLineNumber, "RIGHT")
                    : []
                }
                onAddComment={
                  onAddComment && aligned.right?.newLineNumber
                    ? (body) => handleAddComment(aligned.right!.newLineNumber!, "RIGHT", body)
                    : undefined
                }
                searchQuery={searchQuery}
                currentUser={currentUser}
                onReplyComment={onReplyComment}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onResolveThread={onResolveThread}
                onUnresolveThread={onUnresolveThread}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalHeight = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} className="h-full overflow-y-auto bg-background/30">
      <div className="flex" style={{ height: totalHeight }}>
        <div className="relative w-1/2 overflow-x-auto border-r border-glass-border">
          <div className="min-w-max" style={{ height: totalHeight }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const aligned = alignedLines[virtualRow.index];
              if (!aligned) return null;

              return (
                <div
                  key={`left-${virtualRow.key}`}
                  className="absolute left-0 min-w-full"
                  style={{
                    top: 0,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LeftLine
                    aligned={aligned}
                    tokens={highlightedTokens.get(`left-${virtualRow.index}`)}
                    comments={
                      aligned.left?.oldLineNumber
                        ? getCommentsForLine(aligned.left.oldLineNumber, "LEFT")
                        : []
                    }
                    onAddComment={
                      onAddComment && aligned.left?.oldLineNumber
                        ? (body) => handleAddComment(aligned.left!.oldLineNumber!, "LEFT", body)
                        : undefined
                    }
                    searchQuery={searchQuery}
                    currentUser={currentUser}
                    onReplyComment={onReplyComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolveThread={onResolveThread}
                    onUnresolveThread={onUnresolveThread}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative w-1/2 overflow-x-auto">
          <div className="min-w-max" style={{ height: totalHeight }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const aligned = alignedLines[virtualRow.index];
              if (!aligned) return null;

              return (
                <div
                  key={`right-${virtualRow.key}`}
                  className="absolute left-0 min-w-full"
                  style={{
                    top: 0,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <RightLine
                    aligned={aligned}
                    tokens={
                      aligned.left === aligned.right
                        ? highlightedTokens.get(`left-${virtualRow.index}`)
                        : highlightedTokens.get(`right-${virtualRow.index}`)
                    }
                    comments={
                      aligned.right?.newLineNumber
                        ? getCommentsForLine(aligned.right.newLineNumber, "RIGHT")
                        : []
                    }
                    onAddComment={
                      onAddComment && aligned.right?.newLineNumber
                        ? (body) => handleAddComment(aligned.right!.newLineNumber!, "RIGHT", body)
                        : undefined
                    }
                    searchQuery={searchQuery}
                    currentUser={currentUser}
                    onReplyComment={onReplyComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolveThread={onResolveThread}
                    onUnresolveThread={onUnresolveThread}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const LeftLine = memo(function LeftLine({
  aligned,
  tokens,
  comments,
  onAddComment,
  searchQuery,
  currentUser,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: {
  aligned: AlignedLine;
  tokens?: HighlightedToken[];
  comments: LineComment[];
  onAddComment?: (body: string) => void;
  searchQuery?: string;
  currentUser?: string | null;
  onReplyComment?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}) {
  if (aligned.isHunkHeader) {
    return (
      <div className="flex h-6 items-center bg-muted/80 px-4 font-mono text-xs text-muted-foreground">
        <span className="text-primary/60">@@</span>
        <span className="mx-2">{aligned.hunkHeader}</span>
        <span className="text-primary/60">@@</span>
      </div>
    );
  }

  const line = aligned.left;

  if (!line) {
    return <div className="h-6 bg-muted/20" />;
  }

  const isDeletion = line.type === "deletion";

  const matchesQuery = Boolean(
    searchQuery && line.content.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={cn(
        "flex h-6 font-mono text-xs",
        isDeletion && "bg-red-500/10",
        matchesQuery && "bg-amber-500/15",
      )}
      data-line={line.oldLineNumber}
    >
      <LineGutter
        lineNumber={line.oldLineNumber}
        side="LEFT"
        comments={comments}
        onAddComment={onAddComment}
        lineType={isDeletion ? "deletion" : "context"}
        currentUser={currentUser}
        onReply={onReplyComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onResolveThread={onResolveThread}
        onUnresolveThread={onUnresolveThread}
      />
      <div className="whitespace-pre pl-3 pr-4 leading-6">
        <span
          className={cn(
            "select-none mr-1",
            isDeletion ? "text-red-400" : "text-muted-foreground/40",
          )}
        >
          {isDeletion ? "-" : " "}
        </span>
        <LineContent tokens={tokens} content={line.content} />
      </div>
    </div>
  );
});

const RightLine = memo(function RightLine({
  aligned,
  tokens,
  comments,
  onAddComment,
  searchQuery,
  currentUser,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: {
  aligned: AlignedLine;
  tokens?: HighlightedToken[];
  comments: LineComment[];
  onAddComment?: (body: string) => void;
  searchQuery?: string;
  currentUser?: string | null;
  onReplyComment?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}) {
  if (aligned.isHunkHeader) {
    return (
      <div className="flex h-6 items-center bg-muted/80 px-4 font-mono text-xs text-muted-foreground">
        <span className="text-primary/60">@@</span>
        <span className="mx-2">{aligned.hunkHeader}</span>
        <span className="text-primary/60">@@</span>
      </div>
    );
  }

  const line = aligned.right;

  if (!line) {
    return <div className="h-6 bg-muted/20" />;
  }

  const isAddition = line.type === "addition";

  const matchesQuery = Boolean(
    searchQuery && line.content.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={cn(
        "flex h-6 font-mono text-xs",
        isAddition && "bg-green-500/10",
        matchesQuery && "bg-amber-500/15",
      )}
      data-line={line.newLineNumber}
    >
      <LineGutter
        lineNumber={line.newLineNumber}
        side="RIGHT"
        comments={comments}
        onAddComment={onAddComment}
        lineType={isAddition ? "addition" : "context"}
        currentUser={currentUser}
        onReply={onReplyComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onResolveThread={onResolveThread}
        onUnresolveThread={onUnresolveThread}
      />
      <div className="whitespace-pre pl-3 pr-4 leading-6">
        <span
          className={cn(
            "select-none mr-1",
            isAddition ? "text-green-400" : "text-muted-foreground/40",
          )}
        >
          {isAddition ? "+" : " "}
        </span>
        <LineContent tokens={tokens} content={line.content} />
      </div>
    </div>
  );
});

const LineContent = memo(function LineContent({
  tokens,
  content,
}: {
  tokens?: HighlightedToken[];
  content: string;
}) {
  if (tokens) {
    return (
      <>
        {tokens.map((token, i) => (
          <span key={i} style={{ color: token.color }}>
            {token.content}
          </span>
        ))}
      </>
    );
  }
  return <span className="text-foreground/80">{content}</span>;
});

export { SideBySideDiff };
export type { SideBySideDiffProps };
