export interface FileDiff {
  path: string;
  oldPath: string | null;
  status: DiffStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
}

export type DiffStatus = "added" | "deleted" | "modified" | "renamed" | "copied";

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: LineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export type LineType = "context" | "addition" | "deletion" | "hunk-header";

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ParsedDiff {
  files: FileDiff[];
  stats: DiffStats;
}

export interface LineComment {
  id: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  body: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  createdAt: string;
  isAIGenerated: boolean;
}

export type CommentsByLine = Map<string, LineComment[]>;

export type DiffViewMode = "split" | "unified";
