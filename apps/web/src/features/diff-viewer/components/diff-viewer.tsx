import type { CommentsByLine, DiffViewMode, FileDiff } from "@/types";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import AlertCircle from "lucide-react/dist/esm/icons/circle-alert";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import FileMinus from "lucide-react/dist/esm/icons/file-minus";
import FilePlus from "lucide-react/dist/esm/icons/file-plus";
import Files from "lucide-react/dist/esm/icons/files";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { DiffFileSidebar } from "./diff-file-sidebar";
import { UnifiedDiffView } from "./unified-diff-view";
import { VirtualizedDiff } from "./virtualized-diff";

interface DiffViewerProps {
  files: FileDiff[];
  commentsByLine?: CommentsByLine;
  onAddComment?: (
    filePath: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT",
    body: string,
  ) => void;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  expectedFiles?: number;
  selectedFile?: string | null;
  onSelectFile?: (path: string | null) => void;
  scrollToLine?: number | null;
  scrollToFile?: string | null;
  currentUser?: string | null;
  onReplyComment?: (commentId: number, body: string) => void | Promise<void>;
  onEditComment?: (commentId: number, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: number) => void | Promise<void>;
  onResolveThread?: (threadId: string) => void | Promise<void>;
  onUnresolveThread?: (threadId: string) => void | Promise<void>;
}

interface DiffSearchMatch {
  filePath: string;
  lineNumber: number;
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
  currentUser,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onResolveThread,
  onUnresolveThread,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("split");
  const [isViewModePending, startViewModeTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchTarget, setSearchTarget] = useState<DiffSearchMatch | null>(null);
  const [internalSelectedFile, setInternalSelectedFile] = useState<string | null>(
    files.length > 0 ? (files[0]?.path ?? null) : null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Defer search query to prevent UI blocking during typing
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
  const searchMatches = useMemo<DiffSearchMatch[]>(() => {
    if (!normalizedQuery) return [];
    const matches: DiffSearchMatch[] = [];
    for (const file of files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === "hunk-header") continue;
          if (line.content.toLowerCase().includes(normalizedQuery)) {
            const lineNumber = line.newLineNumber ?? line.oldLineNumber;
            if (lineNumber !== null) {
              matches.push({ filePath: file.path, lineNumber });
            }
          }
        }
      }
    }
    return matches;
  }, [files, normalizedQuery]);

  useEffect(() => {
    if (!normalizedQuery) {
      setSearchIndex(0);
      setSearchTarget(null);
      return;
    }
    if (searchIndex >= searchMatches.length) {
      setSearchIndex(0);
    }
  }, [normalizedQuery, searchMatches.length, searchIndex]);

  useEffect(() => {
    if (scrollToLine || scrollToFile) {
      setSearchTarget(null);
    }
  }, [scrollToLine, scrollToFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const jumpToMatch = useCallback(
    (index: number) => {
      if (searchMatches.length === 0) return;
      const bounded =
        ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;
      const match = searchMatches[bounded];
      setSearchIndex(bounded);
      setSelectedFilePath(match.filePath);
      setSearchTarget(match);
    },
    [searchMatches, setSelectedFilePath],
  );

  const handleViewModeChange = useCallback(
    (mode: DiffViewMode) => {
      startViewModeTransition(() => {
        setViewMode(mode);
      });
    },
    [startViewModeTransition],
  );

  const effectiveScrollToFile = searchTarget?.filePath ?? scrollToFile;
  const effectiveScrollToLine = searchTarget?.lineNumber ?? scrollToLine;

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <DiffHeader
          stats={stats}
          isLoading
          expectedFiles={expectedFiles}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isViewModePending={isViewModePending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMatches={searchMatches}
          searchIndex={searchIndex}
          onJumpToMatch={jumpToMatch}
          onClearSearch={() => setSearchQuery("")}
        />
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Spinner size="xl" className="text-muted-foreground/50" />
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
        <DiffHeader
          stats={stats}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isViewModePending={isViewModePending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMatches={searchMatches}
          searchIndex={searchIndex}
          onJumpToMatch={jumpToMatch}
          onClearSearch={() => setSearchQuery("")}
        />
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
        <DiffHeader
          stats={stats}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isViewModePending={isViewModePending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMatches={searchMatches}
          searchIndex={searchIndex}
          onJumpToMatch={jumpToMatch}
          onClearSearch={() => setSearchQuery("")}
        />
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <FileCode2 className="size-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">No files changed</p>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="diff-viewer" className={cn("flex flex-col gap-4", className)}>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      <div className={cn("flex flex-col gap-4", isFullscreen && "fixed inset-4 z-50")}>
        <DiffHeader
          stats={stats}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isViewModePending={isViewModePending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMatches={searchMatches}
          searchIndex={searchIndex}
          onJumpToMatch={jumpToMatch}
          onClearSearch={() => setSearchQuery("")}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />

        <div
          className={cn(
            "glass-subtle flex overflow-hidden rounded-xl",
            isFullscreen ? "flex-1" : "h-[600px]",
          )}
        >
          {viewMode === "split" ? (
            <>
              <DiffFileSidebar
                files={files}
                selectedFile={selectedFilePath}
                onSelectFile={setSelectedFilePath}
                commentsByLine={commentsByLine}
              />

              <div className="min-w-0 flex-1">
                {selectedFile ? (
                  <VirtualizedDiff
                    file={selectedFile}
                    commentsByLine={commentsByLine}
                    onAddComment={onAddComment}
                    scrollToLine={effectiveScrollToLine}
                    searchQuery={normalizedQuery}
                    currentUser={currentUser}
                    onReplyComment={onReplyComment}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                    onResolveThread={onResolveThread}
                    onUnresolveThread={onUnresolveThread}
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
              scrollToFile={effectiveScrollToFile}
              scrollToLine={effectiveScrollToLine}
              commentsByLine={commentsByLine}
              onAddComment={onAddComment}
              searchQuery={normalizedQuery}
              currentUser={currentUser}
              onReplyComment={onReplyComment}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onResolveThread={onResolveThread}
              onUnresolveThread={onUnresolveThread}
            />
          )}
        </div>
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
  isViewModePending?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchMatches?: DiffSearchMatch[];
  searchIndex?: number;
  onJumpToMatch?: (index: number) => void;
  onClearSearch?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function DiffHeader({
  stats,
  isLoading,
  expectedFiles,
  viewMode,
  onViewModeChange,
  isViewModePending,
  searchQuery,
  onSearchChange,
  searchMatches,
  searchIndex,
  onJumpToMatch,
  onClearSearch,
  isFullscreen,
  onToggleFullscreen,
}: DiffHeaderProps) {
  const matchCount = searchMatches?.length ?? 0;
  const activeMatch = matchCount > 0 ? (searchIndex ?? 0) + 1 : 0;

  return (
    <header className="glass-subtle flex items-center justify-between rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Spinner className="text-primary" />
        ) : (
          <FileCode2 className="size-5 text-primary" />
        )}
        <h2 className="font-display text-sm font-medium text-foreground">Files changed</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search diff"
              className="h-8 w-40 pl-7 pr-7 text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>
              {activeMatch}/{matchCount || 0}
            </span>
            <button
              type="button"
              onClick={() => onJumpToMatch?.((searchIndex ?? 0) - 1)}
              disabled={!matchCount}
              className={cn(
                "rounded p-1 transition-colors",
                matchCount ? "hover:text-foreground" : "cursor-not-allowed opacity-50",
              )}
              title="Previous match"
            >
              <ChevronUp className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => onJumpToMatch?.((searchIndex ?? 0) + 1)}
              disabled={!matchCount}
              className={cn(
                "rounded p-1 transition-colors",
                matchCount ? "hover:text-foreground" : "cursor-not-allowed opacity-50",
              )}
              title="Next match"
            >
              <ChevronDown className="size-3" />
            </button>
          </div>
        </div>

        {viewMode && onViewModeChange && (
          <div className="flex items-center gap-1 rounded-lg bg-background/50 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("split")}
              disabled={isViewModePending}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                viewMode === "split"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
                isViewModePending && "opacity-50",
              )}
              title="Split view"
            >
              {isViewModePending && viewMode !== "split" ? (
                <Spinner className="size-3.5" />
              ) : (
                <LayoutGrid className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("unified")}
              disabled={isViewModePending}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                viewMode === "unified"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
                isViewModePending && "opacity-50",
              )}
              title="Unified view"
            >
              {isViewModePending && viewMode !== "unified" ? (
                <Spinner className="size-3.5" />
              ) : (
                <List className="size-3.5" />
              )}
            </button>
          </div>
        )}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (Esc to exit)"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
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
