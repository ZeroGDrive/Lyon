import type { CommentsByLine, DiffHunk, DiffLine, DiffStatus, FileDiff, LineComment } from "@/types";

import { useVirtualizer } from "@tanstack/react-virtual";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import FileMinus2 from "lucide-react/dist/esm/icons/file-minus-2";
import FilePlus2 from "lucide-react/dist/esm/icons/file-plus-2";
import FileSymlink from "lucide-react/dist/esm/icons/file-symlink";
import Files from "lucide-react/dist/esm/icons/files";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { highlightLinesWithCache, type HighlightedToken } from "@/lib/syntax-highlighter";

import { LineGutter } from "./line-gutter";

// ============================================================================
// Types
// ============================================================================

interface UnifiedDiffViewProps {
  files: FileDiff[];
  scrollToFile?: string | null;
  scrollToLine?: number | null;
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
}

interface AlignedLine {
  left: DiffLine | null;
  right: DiffLine | null;
  isHunkHeader?: boolean;
  hunkHeader?: string;
}

type DiffRow =
  | { type: "file-header"; fileIndex: number; file: FileDiff }
  | { type: "diff-line"; fileIndex: number; lineIndex: number; aligned: AlignedLine; file: FileDiff };

// ============================================================================
// Constants
// ============================================================================

const LINE_HEIGHT = 24;
const FILE_HEADER_HEIGHT = 56;

const statusIcons: Record<DiffStatus, React.ElementType> = {
  added: FilePlus2,
  deleted: FileMinus2,
  modified: FileCode2,
  renamed: FileSymlink,
  copied: Files,
};

const statusColors: Record<DiffStatus, string> = {
  added: "text-green-400",
  deleted: "text-red-400",
  modified: "text-primary",
  renamed: "text-yellow-400",
  copied: "text-purple-400",
};

const statusLabels: Record<DiffStatus, string> = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
  renamed: "Renamed",
  copied: "Copied",
};

// ============================================================================
// Utility Functions
// ============================================================================

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

function getCommentCountForFile(path: string, commentsByLine?: CommentsByLine): number {
  if (!commentsByLine) return 0;
  let count = 0;
  for (const [key, comments] of commentsByLine) {
    if (key.startsWith(`${path}:`)) {
      count += comments.length;
    }
  }
  return count;
}

interface BuildRowsResult {
  rows: DiffRow[];
  fileIndexMap: Map<string, number>;
  lineIndexMap: Map<string, number>;
  alignedLinesCache: Map<number, AlignedLine[]>;
}

function buildRows(
  files: FileDiff[],
  expandedFiles: Set<string>,
): BuildRowsResult {
  const rows: DiffRow[] = [];
  const fileIndexMap = new Map<string, number>();
  const lineIndexMap = new Map<string, number>();
  const alignedLinesCache = new Map<number, AlignedLine[]>();

  files.forEach((file, fileIndex) => {
    fileIndexMap.set(file.path, rows.length);
    rows.push({ type: "file-header", fileIndex, file });

    if (expandedFiles.has(file.path)) {
      const alignedLines = alignHunkLines(file.hunks);
      alignedLinesCache.set(fileIndex, alignedLines);

      alignedLines.forEach((aligned, lineIndex) => {
        const rowIndex = rows.length;

        if (!aligned.isHunkHeader) {
          if (aligned.left?.oldLineNumber != null) {
            lineIndexMap.set(`${file.path}:${aligned.left.oldLineNumber}:LEFT`, rowIndex);
            lineIndexMap.set(`${file.path}:${aligned.left.oldLineNumber}`, rowIndex);
          }
          if (aligned.right?.newLineNumber != null) {
            lineIndexMap.set(`${file.path}:${aligned.right.newLineNumber}:RIGHT`, rowIndex);
            if (aligned.right !== aligned.left) {
              lineIndexMap.set(`${file.path}:${aligned.right.newLineNumber}`, rowIndex);
            }
          }
        }

        rows.push({ type: "diff-line", fileIndex, lineIndex, aligned, file });
      });
    }
  });

  return { rows, fileIndexMap, lineIndexMap, alignedLinesCache };
}

// ============================================================================
// Main Component
// ============================================================================

function UnifiedDiffView({
  files,
  scrollToFile,
  scrollToLine,
  commentsByLine,
  onAddComment,
  searchQuery,
  currentUser,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: UnifiedDiffViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastHandledScrollRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    return new Set(files.slice(0, 5).map((f) => f.path));
  });

  const [highlightedTokens, setHighlightedTokens] = useState<Map<string, HighlightedToken[]>>(
    new Map(),
  );

  const { rows, fileIndexMap, lineIndexMap, alignedLinesCache } = useMemo(
    () => buildRows(files, expandedFiles),
    [files, expandedFiles],
  );

  const dynamicOverscan = rows.length > 500 ? 10 : 30;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      return row?.type === "file-header" ? FILE_HEADER_HEIGHT : LINE_HEIGHT;
    },
    overscan: dynamicOverscan,
  });

  useEffect(() => {
    const allLines: { content: string; key: string }[] = [];

    alignedLinesCache.forEach((alignedLines, fileIndex) => {
      const file = files[fileIndex];
      if (!file) return;

      alignedLines.forEach((aligned, lineIdx) => {
        if (aligned.left && !aligned.isHunkHeader) {
          allLines.push({ content: aligned.left.content, key: `${file.path}:left-${lineIdx}` });
        }
        if (aligned.right && !aligned.isHunkHeader && aligned.right !== aligned.left) {
          allLines.push({ content: aligned.right.content, key: `${file.path}:right-${lineIdx}` });
        }
      });
    });

    if (allLines.length === 0) {
      setHighlightedTokens(new Map());
      return;
    }

    const firstExpandedFile = files.find((f) => expandedFiles.has(f.path));
    const filePath = firstExpandedFile?.path ?? "file.txt";

    highlightLinesWithCache(
      allLines.map((l) => l.content),
      filePath,
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
  }, [alignedLinesCache, files, expandedFiles]);

  useEffect(() => {
    if (!scrollToFile) return;

    // Create a unique key for this scroll target (file + optional line)
    const scrollKey = scrollToLine != null ? `${scrollToFile}:${scrollToLine}` : scrollToFile;

    // Skip if we've already handled this exact scroll target
    // This prevents re-expansion when fileIndexMap/lineIndexMap rebuild after collapse
    if (lastHandledScrollRef.current === scrollKey) return;
    lastHandledScrollRef.current = scrollKey;

    setExpandedFiles((prev) => {
      if (prev.has(scrollToFile)) return prev;
      const next = new Set(prev);
      next.add(scrollToFile);
      return next;
    });

    setTimeout(() => {
      if (scrollToLine != null) {
        const lineKey = `${scrollToFile}:${scrollToLine}`;
        const lineRowIndex = lineIndexMap.get(lineKey);
        if (lineRowIndex != null) {
          virtualizer.scrollToIndex(lineRowIndex, { align: "center" });
          return;
        }
      }

      const fileRowIndex = fileIndexMap.get(scrollToFile);
      if (fileRowIndex != null) {
        virtualizer.scrollToIndex(fileRowIndex, { align: "start" });
      }
    }, 50);
  }, [scrollToFile, scrollToLine, fileIndexMap, lineIndexMap, virtualizer]);

  const toggleFile = useCallback(
    (path: string) => {
      startTransition(() => {
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          if (next.has(path)) {
            next.delete(path);
          } else {
            next.add(path);
          }
          return next;
        });
      });
    },
    [startTransition],
  );

  const expandAll = useCallback(() => {
    const paths = files.map((f) => f.path);
    const BATCH_SIZE = 3;
    let currentIndex = 0;

    const expandBatch = () => {
      if (currentIndex >= paths.length) return;

      const batch = paths.slice(currentIndex, currentIndex + BATCH_SIZE);
      currentIndex += BATCH_SIZE;

      startTransition(() => {
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          for (const path of batch) {
            next.add(path);
          }
          return next;
        });
      });

      if (currentIndex < paths.length) {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(expandBatch, { timeout: 100 });
        } else {
          setTimeout(expandBatch, 16);
        }
      }
    };

    expandBatch();
  }, [files, startTransition]);

  const collapseAll = useCallback(() => {
    startTransition(() => {
      setExpandedFiles(new Set());
    });
  }, []);

  const getCommentsForLine = useCallback(
    (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT"): LineComment[] => {
      if (!commentsByLine) return [];
      const key = `${filePath}:${lineNumber}:${side}`;
      return commentsByLine.get(key) ?? [];
    },
    [commentsByLine],
  );

  const handleAddComment = useCallback(
    (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => {
      return onAddComment?.(filePath, lineNumber, side, body);
    },
    [onAddComment],
  );

  const allExpanded = expandedFiles.size === files.length;
  const noneExpanded = expandedFiles.size === 0;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-glass-border-subtle px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {files.length} {files.length === 1 ? "file" : "files"} changed
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            disabled={allExpanded || isPending}
            className={cn(
              "text-xs transition-colors",
              allExpanded || isPending
                ? "text-muted-foreground/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isPending ? "Expanding..." : "Expand all"}
          </button>
          <span className="text-muted-foreground/50">|</span>
          <button
            type="button"
            onClick={collapseAll}
            disabled={noneExpanded || isPending}
            className={cn(
              "text-xs transition-colors",
              noneExpanded || isPending
                ? "text-muted-foreground/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isPending ? "Collapsing..." : "Collapse all"}
          </button>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "file-header" ? (
                  <FileHeaderRow
                    file={row.file}
                    isExpanded={expandedFiles.has(row.file.path)}
                    onToggle={toggleFile}
                    commentsByLine={commentsByLine}
                  />
                ) : (
                  <DiffLineRow
                    aligned={row.aligned}
                    file={row.file}
                    lineIndex={row.lineIndex}
                    highlightedTokens={highlightedTokens}
                    getCommentsForLine={getCommentsForLine}
                    handleAddComment={handleAddComment}
                    searchQuery={searchQuery}
                    currentUser={currentUser}
                    onAddComment={onAddComment}
                    onReplyComment={onReplyComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolveThread={onResolveThread}
                    onUnresolveThread={onUnresolveThread}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File Header Row Component
// ============================================================================

interface FileHeaderRowProps {
  file: FileDiff;
  isExpanded: boolean;
  onToggle: (path: string) => void;
  commentsByLine?: CommentsByLine;
}

const FileHeaderRow = memo(function FileHeaderRow({
  file,
  isExpanded,
  onToggle,
  commentsByLine,
}: FileHeaderRowProps) {
  const Icon = statusIcons[file.status];
  const commentCount = getCommentCountForFile(file.path, commentsByLine);

  return (
    <button
      type="button"
      onClick={() => onToggle(file.path)}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-glass-highlight",
        "border-b border-glass-border-subtle",
        isExpanded && "bg-glass-highlight/50",
      )}
      style={{ height: FILE_HEADER_HEIGHT }}
    >
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          !isExpanded && "-rotate-90",
        )}
      />
      <Icon className={cn("size-4 shrink-0", statusColors[file.status])} />
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
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
          statusColors[file.status],
          "bg-current/10",
        )}
      >
        {statusLabels[file.status]}
      </span>
      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
        {commentCount > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <MessageSquare className="size-3.5" />
            {commentCount}
          </span>
        )}
        {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
      </div>
    </button>
  );
});

// ============================================================================
// Diff Line Row Component
// ============================================================================

interface DiffLineRowProps {
  aligned: AlignedLine;
  file: FileDiff;
  lineIndex: number;
  highlightedTokens: Map<string, HighlightedToken[]>;
  getCommentsForLine: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT") => LineComment[];
  handleAddComment: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void;
  searchQuery?: string;
  currentUser?: string | null;
  onAddComment?: (
    filePath: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT",
    body: string,
  ) => void;
  onReplyComment?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}

const DiffLineRow = memo(function DiffLineRow({
  aligned,
  file,
  lineIndex,
  highlightedTokens,
  getCommentsForLine,
  handleAddComment,
  searchQuery,
  currentUser,
  onAddComment,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: DiffLineRowProps) {
  const leftTokens = highlightedTokens.get(`${file.path}:left-${lineIndex}`);
  const rightTokens =
    aligned.left === aligned.right
      ? leftTokens
      : highlightedTokens.get(`${file.path}:right-${lineIndex}`);

  return (
    <div className="flex bg-background/30" style={{ height: LINE_HEIGHT }}>
      <div className="w-1/2 min-w-0 overflow-hidden border-r border-glass-border">
        <LeftLine
          aligned={aligned}
          tokens={leftTokens}
          comments={
            aligned.left?.oldLineNumber
              ? getCommentsForLine(file.path, aligned.left.oldLineNumber, "LEFT")
              : []
          }
          onAddComment={
            onAddComment && aligned.left?.oldLineNumber
              ? (body) => handleAddComment(file.path, aligned.left!.oldLineNumber!, "LEFT", body)
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

      <div className="w-1/2 min-w-0 overflow-hidden">
        <RightLine
          aligned={aligned}
          tokens={rightTokens}
          comments={
            aligned.right?.newLineNumber
              ? getCommentsForLine(file.path, aligned.right.newLineNumber, "RIGHT")
              : []
          }
          onAddComment={
            onAddComment && aligned.right?.newLineNumber
              ? (body) => handleAddComment(file.path, aligned.right!.newLineNumber!, "RIGHT", body)
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
    </div>
  );
});

// ============================================================================
// Left Line Component
// ============================================================================

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

// ============================================================================
// Right Line Component
// ============================================================================

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

// ============================================================================
// Line Content Component
// ============================================================================

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

export { UnifiedDiffView };
export type { UnifiedDiffViewProps };
