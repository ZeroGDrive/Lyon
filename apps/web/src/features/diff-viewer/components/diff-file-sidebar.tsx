import type { CommentsByLine, DiffStatus, FileDiff } from "@/types";

import { ChevronDown, ChevronRight, FileCode2, FileMinus2, FilePlus2, Files, FileSymlink, Folder, MessageSquare } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

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
  return nodes.sort((a, b) => {
    // Folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    // Alphabetical within same type
    return a.name.localeCompare(b.name);
  });
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

function DiffFileSidebar({ files, selectedFile, onSelectFile, commentsByLine }: DiffFileSidebarProps) {
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

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-glass-border bg-glass-bg">
      <div className="border-b border-glass-border-subtle px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Changed Files ({files.length})
        </h3>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="min-w-max py-1">
          {sortTreeNodes(Array.from(tree.children.values())).map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onSelectFile={onSelectFile}
              onToggleFolder={toggleFolder}
              commentsByLine={commentsByLine}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  expandedFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  commentsByLine?: CommentsByLine;
}

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  depth,
  selectedFile,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
  commentsByLine,
}: TreeNodeItemProps) {
  const isExpanded = expandedFolders.has(node.path);
  const paddingLeft = 8 + depth * 16;

  if (node.isFolder) {
    const children = sortTreeNodes(Array.from(node.children.values()));

    return (
      <>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="flex w-full items-center gap-1.5 py-1 text-left text-xs transition-colors hover:bg-glass-highlight"
          style={{ paddingLeft }}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <Folder className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-foreground/80">{node.name}</span>
        </button>
        {isExpanded &&
          children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onSelectFile={onSelectFile}
              onToggleFolder={onToggleFolder}
              commentsByLine={commentsByLine}
            />
          ))}
      </>
    );
  }

  // File node
  const file = node.file!;
  const Icon = statusIcons[file.status];
  const isSelected = selectedFile === file.path;
  const commentCount = getCommentCountForFile(file.path, commentsByLine);

  return (
    <button
      type="button"
      onClick={() => onSelectFile(file.path)}
      className={cn(
        "flex w-full items-center gap-1.5 py-1 text-left text-xs",
        "transition-colors hover:bg-glass-highlight",
        isSelected && "bg-primary/10 border-l-2 border-primary",
      )}
      style={{ paddingLeft: paddingLeft + 20 }}
    >
      <Icon className={cn("size-3.5 shrink-0", statusColors[file.status])} />
      <span className="min-w-0 flex-1 truncate font-mono text-foreground/80">{node.name}</span>
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
