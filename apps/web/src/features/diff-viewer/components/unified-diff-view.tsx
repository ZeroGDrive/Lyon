import type { CommentsByLine, DiffStatus, FileDiff } from "@/types";

import { ChevronDown, FileCode2, FileMinus2, FilePlus2, FileSymlink, Files, MessageSquare } from "lucide-react";
import { forwardRef, memo, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

import { SideBySideDiff } from "./side-by-side-diff";

interface UnifiedDiffViewProps {
  files: FileDiff[];
  scrollToFile?: string | null;
  scrollToLine?: number | null;
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

function UnifiedDiffView({ files, scrollToFile, scrollToLine, commentsByLine, onAddComment }: UnifiedDiffViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Start with first 5 files expanded for better initial UX
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    return new Set(files.slice(0, 5).map((f) => f.path));
  });

  // Scroll to file (and optionally line) when scrollToFile changes
  useEffect(() => {
    if (!scrollToFile) return;

    // Expand the file if not already expanded
    setExpandedFiles((prev) => {
      if (prev.has(scrollToFile)) return prev;
      const next = new Set(prev);
      next.add(scrollToFile);
      return next;
    });

    // Scroll to the file (and line if specified) after a brief delay to allow expansion
    setTimeout(() => {
      const fileElement = fileRefs.current.get(scrollToFile);
      if (fileElement) {
        // If we have a specific line, try to scroll to it
        if (scrollToLine) {
          const lineElement = fileElement.querySelector(`[data-line="${scrollToLine}"]`);
          if (lineElement) {
            lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
        // Otherwise just scroll to the file header
        fileElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, [scrollToFile, scrollToLine]);

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
  }, []);

  const expandAll = useCallback(() => {
    setExpandedFiles(new Set(files.map((f) => f.path)));
  }, [files]);

  const collapseAll = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

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
            disabled={allExpanded}
            className={cn(
              "text-xs transition-colors",
              allExpanded ? "text-muted-foreground/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Expand all
          </button>
          <span className="text-muted-foreground/50">|</span>
          <button
            type="button"
            onClick={collapseAll}
            disabled={noneExpanded}
            className={cn(
              "text-xs transition-colors",
              noneExpanded ? "text-muted-foreground/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Collapse all
          </button>
        </div>
      </div>

      <ScrollArea orientation="vertical" className="flex-1" ref={scrollRef}>
        <div className="divide-y divide-glass-border-subtle">
          {files.map((file) => (
            <FileItem
              key={file.path}
              ref={(el: HTMLDivElement | null) => {
                if (el) {
                  fileRefs.current.set(file.path, el);
                } else {
                  fileRefs.current.delete(file.path);
                }
              }}
              file={file}
              isExpanded={expandedFiles.has(file.path)}
              onToggle={toggleFile}
              commentsByLine={commentsByLine}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface FileItemProps {
  file: FileDiff;
  isExpanded: boolean;
  onToggle: (path: string) => void;
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT", body: string) => void;
}

const FileItem = memo(forwardRef<HTMLDivElement, FileItemProps>(
  function FileItem(
    { file, isExpanded, onToggle, commentsByLine, onAddComment },
    ref
  ) {
    const Icon = statusIcons[file.status];
    const commentCount = getCommentCountForFile(file.path, commentsByLine);

    return (
      <div ref={ref}>
        <button
          type="button"
          onClick={() => onToggle(file.path)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-glass-highlight",
            isExpanded && "bg-glass-highlight/50"
          )}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !isExpanded && "-rotate-90"
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
              "bg-current/10"
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

        {isExpanded && (
          <div className="border-t border-glass-border-subtle">
            <SideBySideDiff
              file={file}
              commentsByLine={commentsByLine}
              onAddComment={onAddComment}
            />
          </div>
        )}
      </div>
    );
  }
));

export { UnifiedDiffView };
export type { UnifiedDiffViewProps };
