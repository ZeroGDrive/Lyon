import type { CommentsByLine, DiffStatus, FileDiff as FileDiffType } from "@/types";

import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import FileMinus2 from "lucide-react/dist/esm/icons/file-minus-2";
import FilePlus2 from "lucide-react/dist/esm/icons/file-plus-2";
import FileSymlink from "lucide-react/dist/esm/icons/file-symlink";
import Files from "lucide-react/dist/esm/icons/files";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { DiffHunk } from "./diff-hunk";

interface DiffFileProps {
  file: FileDiffType;
  defaultExpanded?: boolean;
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
}

const statusConfig: Record<DiffStatus, { icon: React.ElementType; color: string; label: string }> =
  {
    added: {
      icon: FilePlus2,
      color: "text-green-400",
      label: "Added",
    },
    deleted: {
      icon: FileMinus2,
      color: "text-red-400",
      label: "Deleted",
    },
    modified: {
      icon: FileCode2,
      color: "text-blue-400",
      label: "Modified",
    },
    renamed: {
      icon: FileSymlink,
      color: "text-yellow-400",
      label: "Renamed",
    },
    copied: {
      icon: Files,
      color: "text-purple-400",
      label: "Copied",
    },
  };

function DiffFile({ file, commentsByLine, onAddComment }: DiffFileProps) {
  const { icon: StatusIcon, color: statusColor, label: statusLabel } = statusConfig[file.status];

  const handleAddComment = (lineNumber: number, side: "LEFT" | "RIGHT") => {
    onAddComment?.(file.path, lineNumber, side);
  };

  return (
    <div data-slot="diff-file" className="flex h-full flex-col">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-glass-border-subtle bg-glass-bg px-4 py-3">
        <StatusIcon className={cn("size-4 shrink-0", statusColor)} />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-sm text-foreground">{file.path}</span>
          {file.oldPath && file.oldPath !== file.path && (
            <span className="ml-2 text-xs text-muted-foreground">(from {file.oldPath})</span>
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

      {file.binary ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          Binary file not shown
        </div>
      ) : file.hunks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          No changes to display
        </div>
      ) : (
        <ScrollArea orientation="both" className="flex-1 bg-background/30">
          <div className="min-w-max">
            {file.hunks.map((hunk, index) => (
              <DiffHunk
                key={index}
                hunk={hunk}
                filePath={file.path}
                hunkIndex={index}
                commentsByLine={commentsByLine}
                onAddComment={handleAddComment}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export { DiffFile };
