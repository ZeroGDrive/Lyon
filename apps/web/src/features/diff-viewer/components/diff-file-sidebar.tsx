import type { CommentsByLine, DiffStatus, FileDiff } from "@/types";

import { useVirtualizer } from "@tanstack/react-virtual";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import FileMinus2 from "lucide-react/dist/esm/icons/file-minus-2";
import FilePlus2 from "lucide-react/dist/esm/icons/file-plus-2";
import Files from "lucide-react/dist/esm/icons/files";
import FileSymlink from "lucide-react/dist/esm/icons/file-symlink";
import Folder from "lucide-react/dist/esm/icons/folder";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface DiffFileSidebarProps {
  files: FileDiff[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  commentsByLine?: CommentsByLine;
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

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: Map<string, TreeNode>;
  file?: FileDiff;
}

interface FlatRow {
  key: string;
  depth: number;
  type: "folder" | "file";
  name: string;
  path: string;
  isExpanded?: boolean;
  file?: FileDiff;
}

const ROW_HEIGHT = 28;

function buildFileTree(files: FileDiff[]): TreeNode {
  const root: TreeNode = {
    name: "",
    path: "",
    isFolder: true,
    children: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: new Map(),
          file: isLast ? file : undefined,
        });
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.toSorted((a, b) => {
    // Folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    // Alphabetical within same type
    return a.name.localeCompare(b.name);
  });
}

function flattenTree(root: TreeNode, expandedFolders: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];

  function traverse(node: TreeNode, depth: number) {
    if (node.path) {
      // Skip root
      rows.push({
        key: node.path,
        depth,
        type: node.isFolder ? "folder" : "file",
        name: node.name,
        path: node.path,
        isExpanded: node.isFolder ? expandedFolders.has(node.path) : undefined,
        file: node.file,
      });
    }

    if (node.isFolder && (node.path === "" || expandedFolders.has(node.path))) {
      const children = sortTreeNodes(Array.from(node.children.values()));
      for (const child of children) {
        traverse(child, node.path ? depth + 1 : 0);
      }
    }
  }

  traverse(root, 0);
  return rows;
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

function DiffFileSidebar({
  files,
  selectedFile,
  onSelectFile,
  commentsByLine,
}: DiffFileSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildFileTree(files), [files]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Initially expand all folders
    const expanded = new Set<string>();
    function collectFolders(node: TreeNode) {
      if (node.isFolder && node.path) {
        expanded.add(node.path);
      }
      for (const child of node.children.values()) {
        collectFolders(child);
      }
    }
    collectFolders(tree);
    return expanded;
  });

  // Loading state for file selection
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Loading state for folder toggle
  const [, startFolderTransition] = useTransition();

  const handleSelectFile = useCallback(
    (path: string) => {
      setPendingPath(path);
      startTransition(() => {
        onSelectFile(path);
      });
    },
    [onSelectFile],
  );

  // Clear pendingPath when selection matches
  useEffect(() => {
    if (selectedFile === pendingPath) {
      setPendingPath(null);
    }
  }, [selectedFile, pendingPath]);

  const toggleFolder = useCallback((path: string) => {
    startFolderTransition(() => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    });
  }, []);

  const flatRows = useMemo(() => flattenTree(tree, expandedFolders), [tree, expandedFolders]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-glass-border bg-glass-bg">
      <div className="border-b border-glass-border-subtle px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Changed Files ({files.length})
        </h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="relative min-w-max" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatRows[virtualRow.index];
            if (!row) return null;

            return (
              <VirtualRow
                key={row.key}
                row={row}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                selectedFile={selectedFile}
                pendingPath={pendingPath}
                onSelectFile={handleSelectFile}
                onToggleFolder={toggleFolder}
                commentsByLine={commentsByLine}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface VirtualRowProps {
  row: FlatRow;
  style: React.CSSProperties;
  selectedFile: string | null;
  pendingPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  commentsByLine?: CommentsByLine;
}

const VirtualRow = memo(function VirtualRow({
  row,
  style,
  selectedFile,
  pendingPath,
  onSelectFile,
  onToggleFolder,
  commentsByLine,
}: VirtualRowProps) {
  const paddingLeft = 8 + row.depth * 16;

  if (row.type === "folder") {
    return (
      <button
        type="button"
        onClick={() => onToggleFolder(row.path)}
        className="flex w-full items-center gap-1.5 text-left text-xs transition-colors hover:bg-glass-highlight"
        style={{ ...style, paddingLeft, paddingTop: 4, paddingBottom: 4 }}
      >
        {row.isExpanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="whitespace-nowrap font-mono text-foreground/80">{row.name}</span>
      </button>
    );
  }

  // File row
  const file = row.file!;
  const Icon = statusIcons[file.status];
  const isSelected = selectedFile === file.path;
  const isPending = pendingPath === file.path;
  const commentCount = getCommentCountForFile(file.path, commentsByLine);

  return (
    <button
      type="button"
      onClick={() => onSelectFile(file.path)}
      className={cn(
        "flex w-full items-center gap-1.5 text-left text-xs",
        "transition-colors hover:bg-glass-highlight",
        isSelected && "bg-primary/10 border-l-2 border-primary",
      )}
      style={{ ...style, paddingLeft: paddingLeft + 20, paddingTop: 4, paddingBottom: 4 }}
    >
      {isPending ? (
        <Spinner size="xs" className="shrink-0 text-primary" />
      ) : (
        <Icon className={cn("size-3.5 shrink-0", statusColors[file.status])} />
      )}
      <span className="whitespace-nowrap font-mono text-foreground/80">{row.name}</span>
      <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[10px] font-medium">
        {commentCount > 0 && (
          <span className="flex items-center gap-0.5 text-primary">
            <MessageSquare className="size-3" />
            {commentCount}
          </span>
        )}
        {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
      </div>
    </button>
  );
});

export { DiffFileSidebar };
