import type { CommentsByLine, DiffViewMode, FileDiff } from "@/types";

import { useState } from "react";
import {
  AlertCircle,
  FileCode2,
  FileMinus,
  FilePlus,
  Files,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { DiffFileSidebar } from "./diff-file-sidebar";
import { UnifiedDiffView } from "./unified-diff-view";
import { VirtualizedDiff } from "./virtualized-diff";

interface DiffViewerProps {
  files: FileDiff[];
  commentsByLine?: CommentsByLine;
  onAddComment?: (filePath: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  expectedFiles?: number;
  selectedFile?: string | null;
  onSelectFile?: (path: string | null) => void;
  scrollToLine?: number | null;
  scrollToFile?: string | null;
}

function DiffViewer({
  files,
  commentsByLine,
  onAddComment,
  className,
  isLoading,
  error,
  expectedFiles,
  selectedFile: controlledSelectedFile,
  onSelectFile,
  scrollToLine,
  scrollToFile,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("split");
  const [internalSelectedFile, setInternalSelectedFile] = useState<string | null>(
    files.length > 0 ? (files[0]?.path ?? null) : null,
  );

  const selectedFilePath = controlledSelectedFile ?? internalSelectedFile;
  const setSelectedFilePath = onSelectFile ?? setInternalSelectedFile;

  const selectedFile = files.find((f) => f.path === selectedFilePath) ?? null;

  const stats = files.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { filesChanged: 0, additions: 0, deletions: 0 },
  );

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <DiffHeader stats={stats} isLoading expectedFiles={expectedFiles} />
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Loader2 className="size-12 animate-spin text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">Loading diff...</p>
          {expectedFiles && expectedFiles > 0 && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              {expectedFiles} {expectedFiles === 1 ? "file" : "files"} to load
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <DiffHeader stats={stats} />
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <AlertCircle className="size-12 text-destructive/50" />
          <p className="mt-4 text-sm font-medium text-foreground">Failed to load diff</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <DiffHeader stats={stats} />
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <FileCode2 className="size-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">No files changed</p>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="diff-viewer" className={cn("flex flex-col gap-4", className)}>
      <DiffHeader stats={stats} viewMode={viewMode} onViewModeChange={setViewMode} />

      <div className="glass-subtle flex h-[600px] overflow-hidden rounded-xl">
        {viewMode === "split" ? (
          <>
            <DiffFileSidebar
              files={files}
              selectedFile={selectedFilePath}
              onSelectFile={setSelectedFilePath}
            />

            <div className="flex-1 overflow-hidden">
              {selectedFile ? (
                <VirtualizedDiff
                  file={selectedFile}
                  commentsByLine={commentsByLine}
                  onAddComment={onAddComment}
                  scrollToLine={scrollToLine}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a file to view changes
                </div>
              )}
            </div>
          </>
        ) : (
          <UnifiedDiffView
            files={files}
            scrollToFile={scrollToFile}
          />
        )}
      </div>
    </div>
  );
}

interface DiffHeaderProps {
  stats: { filesChanged: number; additions: number; deletions: number };
  isLoading?: boolean;
  expectedFiles?: number;
  viewMode?: DiffViewMode;
  onViewModeChange?: (mode: DiffViewMode) => void;
}

function DiffHeader({
  stats,
  isLoading,
  expectedFiles,
  viewMode,
  onViewModeChange,
}: DiffHeaderProps) {
  return (
    <header className="glass-subtle flex items-center justify-between rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Loader2 className="size-5 animate-spin text-primary" />
        ) : (
          <FileCode2 className="size-5 text-primary" />
        )}
        <h2 className="font-display text-sm font-medium text-foreground">Files changed</h2>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium">
        {viewMode && onViewModeChange && (
          <div className="flex items-center gap-1 rounded-lg bg-background/50 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("split")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                viewMode === "split"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Split view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("unified")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                viewMode === "unified"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Unified view"
            >
              <List className="size-3.5" />
            </button>
          </div>
        )}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Files className="size-3.5" />
          <span>{isLoading && expectedFiles ? expectedFiles : stats.filesChanged}</span>
        </span>
        <span className="flex items-center gap-1.5 text-green-400">
          <FilePlus className="size-3.5" />
          <span>+{stats.additions}</span>
        </span>
        <span className="flex items-center gap-1.5 text-red-400">
          <FileMinus className="size-3.5" />
          <span>-{stats.deletions}</span>
        </span>
      </div>
    </header>
  );
}

export { DiffViewer };
export type { DiffViewerProps };
