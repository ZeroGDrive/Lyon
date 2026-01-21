import type { DiffHunk, DiffLine, FileDiff } from "@/types";

import { memo, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { highlightLines, type HighlightedToken } from "@/lib/syntax-highlighter";

interface SideBySideDiffProps {
  file: FileDiff;
}

interface AlignedLine {
  left: DiffLine | null;
  right: DiffLine | null;
  isHunkHeader?: boolean;
  hunkHeader?: string;
}

/**
 * Process hunks to create aligned left/right line pairs.
 */
function alignHunkLines(hunks: DiffHunk[]): AlignedLine[] {
  const aligned: AlignedLine[] = [];

  for (const hunk of hunks) {
    // Add hunk header
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
        // Collect consecutive deletions
        const deletions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "deletion") {
          deletions.push(lines[i]);
          i++;
        }
        // Collect consecutive additions
        const additions: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "addition") {
          additions.push(lines[i]);
          i++;
        }
        // Pair them up
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

function SideBySideDiff({ file }: SideBySideDiffProps) {
  const [highlightedTokens, setHighlightedTokens] = useState<Map<string, HighlightedToken[]>>(
    new Map()
  );
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const alignedLines = useMemo(() => alignHunkLines(file.hunks), [file.hunks]);

  // Syntax highlighting
  useEffect(() => {
    const allLines: { content: string; key: string }[] = [];

    alignedLines.forEach((aligned, index) => {
      if (aligned.left && !aligned.isHunkHeader) {
        allLines.push({ content: aligned.left.content, key: `left-${index}` });
      }
      if (aligned.right && !aligned.isHunkHeader && aligned.right !== aligned.left) {
        allLines.push({ content: aligned.right.content, key: `right-${index}` });
      }
    });

    if (allLines.length === 0) return;

    highlightLines(
      allLines.map((l) => l.content),
      file.path
    ).then((tokens) => {
      const map = new Map<string, HighlightedToken[]>();
      tokens.forEach((t, i) => {
        map.set(allLines[i].key, t);
      });
      setHighlightedTokens(map);
    });
  }, [alignedLines, file.path]);

  if (file.binary) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Binary file not shown
      </div>
    );
  }

  return (
    <div className="flex bg-background/30">
      {/* Left panel (old/deletions) */}
      <div
        ref={leftPanelRef}
        className="flex-1 overflow-x-auto border-r border-glass-border"
      >
        <div className="min-w-max">
          {alignedLines.map((aligned, index) => (
            <LeftLine
              key={index}
              aligned={aligned}
              tokens={highlightedTokens.get(`left-${index}`)}
            />
          ))}
        </div>
      </div>

      {/* Right panel (new/additions) */}
      <div
        ref={rightPanelRef}
        className="flex-1 overflow-x-auto"
      >
        <div className="min-w-max">
          {alignedLines.map((aligned, index) => (
            <RightLine
              key={index}
              aligned={aligned}
              tokens={
                aligned.left === aligned.right
                  ? highlightedTokens.get(`left-${index}`)
                  : highlightedTokens.get(`right-${index}`)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const LeftLine = memo(function LeftLine({
  aligned,
  tokens,
}: {
  aligned: AlignedLine;
  tokens?: HighlightedToken[];
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

  return (
    <div
      className={cn(
        "flex h-6 font-mono text-xs",
        isDeletion && "bg-red-500/10"
      )}
    >
      <span
        className={cn(
          "flex w-12 shrink-0 select-none items-center justify-end px-2 border-r border-glass-border-subtle",
          isDeletion ? "bg-red-950 text-red-500/70" : "text-muted-foreground/50"
        )}
      >
        {line.oldLineNumber}
      </span>
      <div className="whitespace-pre pl-3 pr-4 leading-6">
        <span
          className={cn(
            "select-none mr-1",
            isDeletion ? "text-red-400" : "text-muted-foreground/40"
          )}
        >
          {isDeletion ? "-" : " "}
        </span>
        <LineContent tokens={tokens} content={line.content} />
      </div>
    </div>
  );
});

const RightLine = memo(function RightLine({
  aligned,
  tokens,
}: {
  aligned: AlignedLine;
  tokens?: HighlightedToken[];
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

  return (
    <div
      className={cn(
        "flex h-6 font-mono text-xs",
        isAddition && "bg-green-500/10"
      )}
    >
      <span
        className={cn(
          "flex w-12 shrink-0 select-none items-center justify-end px-2 border-r border-glass-border-subtle",
          isAddition ? "bg-green-950 text-green-500/70" : "text-muted-foreground/50"
        )}
      >
        {line.newLineNumber}
      </span>
      <div className="whitespace-pre pl-3 pr-4 leading-6">
        <span
          className={cn(
            "select-none mr-1",
            isAddition ? "text-green-400" : "text-muted-foreground/40"
          )}
        >
          {isAddition ? "+" : " "}
        </span>
        <LineContent tokens={tokens} content={line.content} />
      </div>
    </div>
  );
});

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

export { SideBySideDiff };
export type { SideBySideDiffProps };
