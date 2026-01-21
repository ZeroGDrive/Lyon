import type { DiffHunk, DiffLine, DiffStatus, FileDiff, LineType, ParsedDiff } from "@/types";

export function parseDiff(diffText: string): ParsedDiff {
  const files: FileDiff[] = [];
  const lines = diffText.split("\n");

  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    if (line.startsWith("diff --git ")) {
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      const newPath = match?.[2] ?? line.slice(13);
      const oldPath = match?.[1] ?? null;

      currentFile = {
        path: newPath,
        oldPath: oldPath !== newPath ? oldPath : null,
        status: "modified" as DiffStatus,
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith("new file mode")) {
      currentFile.status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      currentFile.status = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      currentFile.status = "renamed";
      currentFile.oldPath = line.slice(12);
      continue;
    }
    if (line.startsWith("rename to ")) {
      currentFile.path = line.slice(10);
      continue;
    }
    if (line.startsWith("similarity index")) {
      continue;
    }
    if (line.startsWith("copy from ")) {
      currentFile.status = "copied";
      currentFile.oldPath = line.slice(10);
      continue;
    }
    if (line.startsWith("copy to ")) {
      currentFile.path = line.slice(8);
      continue;
    }
    if (line.startsWith("Binary files")) {
      currentFile.binary = true;
      continue;
    }

    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    if (line.startsWith("index ")) {
      continue;
    }

    // @@ -start,count +start,count @@ context
    if (line.startsWith("@@")) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?/);
      if (match) {
        oldLineNumber = parseInt(match[1] ?? "1", 10);
        newLineNumber = parseInt(match[3] ?? "1", 10);
        const oldLines = parseInt(match[2] ?? "1", 10);
        const newLines = parseInt(match[4] ?? "1", 10);

        currentHunk = {
          header: line,
          oldStart: oldLineNumber,
          oldLines,
          newStart: newLineNumber,
          newLines,
          lines: [],
        };

        const headerLine: DiffLine = {
          type: "hunk-header" as LineType,
          content: match[5]?.trim() ?? "",
          oldLineNumber: null,
          newLineNumber: null,
        };
        currentHunk.lines.push(headerLine);
      }
      continue;
    }

    if (currentHunk) {
      let lineType: LineType;
      let content: string;

      if (line.startsWith("+")) {
        lineType = "addition";
        content = line.slice(1);
        currentFile.additions++;

        const diffLine: DiffLine = {
          type: lineType,
          content,
          oldLineNumber: null,
          newLineNumber: newLineNumber,
        };
        currentHunk.lines.push(diffLine);
        newLineNumber++;
      } else if (line.startsWith("-")) {
        lineType = "deletion";
        content = line.slice(1);
        currentFile.deletions++;

        const diffLine: DiffLine = {
          type: lineType,
          content,
          oldLineNumber: oldLineNumber,
          newLineNumber: null,
        };
        currentHunk.lines.push(diffLine);
        oldLineNumber++;
      } else if (line.startsWith(" ") || line === "") {
        lineType = "context";
        content = line.slice(1);

        const diffLine: DiffLine = {
          type: lineType,
          content,
          oldLineNumber: oldLineNumber,
          newLineNumber: newLineNumber,
        };
        currentHunk.lines.push(diffLine);
        oldLineNumber++;
        newLineNumber++;
      } else if (line.startsWith("\\")) {
        continue;
      }
    }
  }

  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(currentFile);
  }

  const stats = files.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { filesChanged: 0, additions: 0, deletions: 0 },
  );

  return { files, stats };
}
