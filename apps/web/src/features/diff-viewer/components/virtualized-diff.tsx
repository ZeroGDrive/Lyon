import type {
  CommentsByLine,
  DiffHunk as DiffHunkType,
  DiffLine as DiffLineType,
  DiffStatus,
  FileDiff,
  LineComment,
} from "@/types";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FileCode2,
  FileMinus2,
  FilePlus2,
  FileSymlink,
  Files,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { highlightLines, type HighlightedToken } from "@/lib/syntax-highlighter";
import { LineCommentPopover } from "./line-comment-popover";

interface VirtualizedDiffProps {
  file: FileDiff;
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void;
  scrollToLine?: number | null;
  hideHeader?: boolean;
  /** Render all lines without virtualization (for unified view with external scroll) */
  disableVirtualization?: boolean;
}

interface FlattenedLine {
  type: "hunk-header" | "line";
  hunkIndex: number;
  lineIndex: number;
  line: DiffLineType;
  hunk: DiffHunkType;
}

const statusConfig: Record<DiffStatus, { icon: React.ElementType; color: string; label: string }> =
  {
    added: { icon: FilePlus2, color: "text-green-400", label: "Added" },
    deleted: { icon: FileMinus2, color: "text-red-400", label: "Deleted" },
    modified: { icon: FileCode2, color: "text-blue-400", label: "Modified" },
    renamed: { icon: FileSymlink, color: "text-yellow-400", label: "Renamed" },
    copied: { icon: Files, color: "text-purple-400", label: "Copied" },
  };

const LINE_HEIGHT = 24;

function VirtualizedDiff({ file, commentsByLine, onAddComment, scrollToLine, hideHeader, disableVirtualization }: VirtualizedDiffProps) {
  const { icon: StatusIcon, color: statusColor, label: statusLabel } = statusConfig[file.status];
  const parentRef = useRef<HTMLDivElement>(null);
  const [highlightedTokens, setHighlightedTokens] = useState<Map<string, HighlightedToken[]>>(
    new Map(),
  );

  const flattenedLines = useMemo(() => {
    const lines: FlattenedLine[] = [];
    file.hunks.forEach((hunk, hunkIndex) => {
      hunk.lines.forEach((line, lineIndex) => {
        lines.push({
          type: line.type === "hunk-header" ? "hunk-header" : "line",
          hunkIndex,
          lineIndex,
          line,
          hunk,
        });
      });
    });
    return lines;
  }, [file.hunks]);

  useEffect(() => {
    const codeLines = flattenedLines.filter((f) => f.type === "line").map((f) => f.line.content);

    if (codeLines.length === 0) return;

    highlightLines(codeLines, file.path).then((tokens) => {
      const tokenMap = new Map<string, HighlightedToken[]>();
      let tokenIndex = 0;
      flattenedLines.forEach((f) => {
        if (f.type === "line") {
          const key = `${f.hunkIndex}-${f.lineIndex}`;
          tokenMap.set(key, tokens[tokenIndex] ?? [{ content: f.line.content }]);
          tokenIndex++;
        }
      });
      setHighlightedTokens(tokenMap);
    });
  }, [flattenedLines, file.path]);

  const virtualizer = useVirtualizer({
    count: flattenedLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 30,
  });

  // Scroll to line when scrollToLine prop changes
  useEffect(() => {
    if (scrollToLine === null || scrollToLine === undefined) return;

    // Find the index of the line with the matching line number (newLineNumber or oldLineNumber)
    const targetIndex = flattenedLines.findIndex(
      (item) =>
        item.type === "line" &&
        (item.line.newLineNumber === scrollToLine || item.line.oldLineNumber === scrollToLine)
    );

    if (targetIndex !== -1) {
      virtualizer.scrollToIndex(targetIndex, { align: "center" });
    }
  }, [scrollToLine, flattenedLines, virtualizer]);

  const widestLineContent = useMemo(() => {
    let best = "";
    for (const item of flattenedLines) {
      if (item.type === "line" && item.line.content.length > best.length) {
        best = item.line.content;
      }
    }
    return best || " ";
  }, [flattenedLines]);

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

  return (
    <div data-slot="virtualized-diff" className="flex h-full flex-col">
      {!hideHeader && (
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-glass-border-subtle bg-glass-bg px-4 py-3">
          <StatusIcon className={cn("size-4 shrink-0", statusColor)} />
          <div className="min-w-0 flex-1 overflow-hidden">
            <span
              className="block truncate font-mono text-sm text-foreground"
              style={{ direction: "rtl", textAlign: "left" }}
              title={file.path}
            >
              {file.path}
            </span>
            {file.oldPath && file.oldPath !== file.path && (
              <span className="text-xs text-muted-foreground">(from {file.oldPath})</span>
            )}
          </div>
          <span
            className={cn("rounded px-2 py-0.5 text-xs font-medium", statusColor, "bg-current/10")}
          >
            {statusLabel}
          </span>
          <div className="flex items-center gap-3 text-xs font-medium">
            {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
            {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
          </div>
        </div>
      )}

      {file.binary ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          Binary file not shown
        </div>
      ) : flattenedLines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          No changes to display
        </div>
      ) : disableVirtualization ? (
        <div className="bg-background/30">
          {flattenedLines.map((item, index) => {
            const tokenKey = `${item.hunkIndex}-${item.lineIndex}`;
            const tokens = highlightedTokens.get(tokenKey);

            const bgClass =
              item.type === "line"
                ? item.line.type === "addition"
                  ? "bg-green-500/10"
                  : item.line.type === "deletion"
                    ? "bg-red-500/10"
                    : ""
                : "";

            return (
              <div key={index} className={bgClass}>
                {item.type === "hunk-header" ? (
                  <HunkHeader header={item.hunk.header} />
                ) : (
                  <DiffLineRow
                    line={item.line}
                    tokens={tokens}
                    leftComments={getCommentsForLine(item.line.oldLineNumber ?? 0, "LEFT")}
                    rightComments={getCommentsForLine(item.line.newLineNumber ?? 0, "RIGHT")}
                    onAddComment={onAddComment ? handleAddComment : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto bg-background/30"
        >
          <div
            className="relative"
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              minWidth: `max(100%, ${widestLineContent.length}ch + 8rem)`,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = flattenedLines[virtualRow.index];
              if (!item) return null;

              const tokenKey = `${item.hunkIndex}-${item.lineIndex}`;
              const tokens = highlightedTokens.get(tokenKey);

              const bgClass =
                item.type === "line"
                  ? item.line.type === "addition"
                    ? "bg-green-500/10"
                    : item.line.type === "deletion"
                      ? "bg-red-500/10"
                      : ""
                  : "";

              return (
                <div
                  key={virtualRow.key}
                  className={cn("absolute inset-x-0", bgClass)}
                  style={{
                    top: 0,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {item.type === "hunk-header" ? (
                    <HunkHeader header={item.hunk.header} />
                  ) : (
                    <DiffLineRow
                      line={item.line}
                      tokens={tokens}
                      leftComments={getCommentsForLine(item.line.oldLineNumber ?? 0, "LEFT")}
                      rightComments={getCommentsForLine(item.line.newLineNumber ?? 0, "RIGHT")}
                      onAddComment={onAddComment ? handleAddComment : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const HunkHeader = memo(function HunkHeader({ header }: { header: string }) {
  return (
    <div className="sticky top-0 z-10 flex h-6 items-center gap-2 bg-muted/80 px-4 font-mono text-xs text-muted-foreground backdrop-blur-sm">
      <span className="shrink-0 text-primary/60">@@</span>
      <span>{header}</span>
      <span className="shrink-0 text-primary/60">@@</span>
    </div>
  );
});

interface DiffLineRowProps {
  line: DiffLineType;
  tokens?: HighlightedToken[];
  leftComments: LineComment[];
  rightComments: LineComment[];
  onAddComment?: (lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void | Promise<void>;
}

const DiffLineRow = memo(function DiffLineRow({
  line,
  tokens,
  leftComments,
  rightComments,
  onAddComment,
}: DiffLineRowProps) {
  const { type, content, oldLineNumber, newLineNumber } = line;
  const prefix = type === "addition" ? "+" : type === "deletion" ? "-" : " ";

  return (
    <div className="flex h-6 items-stretch font-mono text-xs leading-6">
      <div className="sticky left-0 z-20">
        <LineCommentPopover
          lineNumber={oldLineNumber}
          side="LEFT"
          comments={leftComments}
          onAddComment={
            onAddComment && oldLineNumber !== null
              ? (body) => onAddComment(oldLineNumber, "LEFT", body)
              : undefined
          }
          lineType={type === "deletion" ? "deletion" : "context"}
        />
      </div>

      <div className="sticky left-12 z-20">
        <LineCommentPopover
          lineNumber={newLineNumber}
          side="RIGHT"
          comments={rightComments}
          onAddComment={
            onAddComment && newLineNumber !== null
              ? (body) => onAddComment(newLineNumber, "RIGHT", body)
              : undefined
          }
          lineType={type === "addition" ? "addition" : "context"}
        />
      </div>

      <div className="flex-1 whitespace-pre pl-3 pr-4">
        <span
          className={cn(
            "select-none mr-1",
            type === "addition" && "text-green-400",
            type === "deletion" && "text-red-400",
            type === "context" && "text-muted-foreground/40",
          )}
        >
          {prefix}
        </span>
        {tokens ? (
          tokens.map((token, i) => (
            <span key={i} style={{ color: token.color }}>
              {token.content}
            </span>
          ))
        ) : (
          <span className="text-foreground/80">{content}</span>
        )}
      </div>
    </div>
  );
});

export { VirtualizedDiff };
