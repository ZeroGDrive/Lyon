import type { CommentsByLine, DiffStatus, FileDiff } from "@/types";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, FileCode2, FileMinus2, FilePlus2, FileSymlink, Files } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { SideBySideDiff } from "./side-by-side-diff";

interface UnifiedDiffViewProps {
  files: FileDiff[];
  scrollToFile?: string | null;
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void;
}

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
  modified: "text-blue-400",
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

const HEADER_HEIGHT = 48;
const LINE_HEIGHT = 24;

function UnifiedDiffView({ files, scrollToFile, commentsByLine, onAddComment }: UnifiedDiffViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    return new Set(files.slice(0, 3).map((f) => f.path));
  });
  const [renderedFiles, setRenderedFiles] = useState<Set<string>>(() => {
    return new Set(files.slice(0, 3).map((f) => f.path));
  });

  // Estimate height for each file
  const getEstimatedHeight = useCallback(
    (index: number) => {
      const file = files[index];
      if (!file) return HEADER_HEIGHT;

      if (!expandedFiles.has(file.path)) {
        return HEADER_HEIGHT;
      }

      // Estimate based on number of lines in hunks
      const totalLines = file.hunks.reduce((acc, hunk) => acc + hunk.lines.length + 1, 0);
      return HEADER_HEIGHT + totalLines * LINE_HEIGHT;
    },
    [files, expandedFiles]
  );

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getEstimatedHeight,
    overscan: 3,
  });

  // Re-measure when expanded files change
  useEffect(() => {
    virtualizer.measure();
  }, [expandedFiles, virtualizer]);

  // Scroll to file when scrollToFile changes
  useEffect(() => {
    if (!scrollToFile) return;

    const index = files.findIndex((f) => f.path === scrollToFile);
    if (index !== -1) {
      setExpandedFiles((prev) => {
        const next = new Set(prev);
        next.add(scrollToFile);
        return next;
      });
      setRenderedFiles((prev) => {
        const next = new Set(prev);
        next.add(scrollToFile);
        return next;
      });

      setTimeout(() => {
        virtualizer.scrollToIndex(index, { align: "start" });
      }, 100);
    }
  }, [scrollToFile, files, virtualizer]);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    setRenderedFiles((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set(files.map((f) => f.path));
    setExpandedFiles(allPaths);
    setRenderedFiles(allPaths);
  }, [files]);

  const collapseAll = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-glass-border-subtle px-4 py-2">
        <button
          type="button"
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Expand all
        </button>
        <span className="text-muted-foreground/50">|</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Collapse all
        </button>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const file = files[virtualRow.index];
            if (!file) return null;

            const isExpanded = expandedFiles.has(file.path);
            const shouldRender = renderedFiles.has(file.path);

            return (
              <div
                key={file.path}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileItem
                  file={file}
                  isExpanded={isExpanded}
                  shouldRender={shouldRender}
                  onToggle={toggleFile}
                  commentsByLine={commentsByLine}
                  onAddComment={onAddComment}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface FileItemProps {
  file: FileDiff;
  isExpanded: boolean;
  shouldRender: boolean;
  onToggle: (path: string) => void;
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void;
}

const FileItem = memo(function FileItem({
  file,
  isExpanded,
  shouldRender,
  onToggle,
  commentsByLine,
  onAddComment,
}: FileItemProps) {
  const Icon = statusIcons[file.status];

  return (
    <div className="border-b border-glass-border-subtle">
      <button
        type="button"
        onClick={() => onToggle(file.path)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-glass-highlight"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !isExpanded && "-rotate-90"
          )}
        />
        <Icon className={cn("size-4 shrink-0", statusColors[file.status])} />
        <div className="min-w-0 flex-1">
          <span className="truncate font-mono text-sm text-foreground">{file.path}</span>
          {file.oldPath && file.oldPath !== file.path && (
            <span className="ml-2 text-xs text-muted-foreground">(from {file.oldPath})</span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
            statusColors[file.status],
            "bg-current/10"
          )}
        >
          {statusLabels[file.status]}
        </span>
        <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
          {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
        </div>
      </button>

      {isExpanded && shouldRender && (
          <SideBySideDiff
            file={file}
            commentsByLine={commentsByLine}
            onAddComment={onAddComment}
          />
        )}
    </div>
  );
});

export { UnifiedDiffView };
export type { UnifiedDiffViewProps };
