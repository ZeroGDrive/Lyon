import type { PullRequest, Repository } from "@/types";

import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import GitPullRequest from "lucide-react/dist/esm/icons/git-pull-request";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRListItem } from "./pr-list-item";

interface PRListProps {
  repositories: Repository[];
  pullRequestsByRepo: Map<string, PullRequest[]>;
  selectedPR: PullRequest | null;
  onSelectPR: (pr: PullRequest) => void;
  isLoading?: boolean;
  onRemoveRepo?: (repoFullName: string) => void;
}

function PRList({
  repositories,
  pullRequestsByRepo,
  selectedPR,
  onSelectPR,
  isLoading,
  onRemoveRepo,
}: PRListProps) {
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(
    new Set(repositories.map((r) => r.fullName)),
  );

  const toggleRepo = (repoFullName: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoFullName)) {
        next.delete(repoFullName);
      } else {
        next.add(repoFullName);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, repoIdx) => (
          <div key={repoIdx} className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="h-4 w-4 rounded bg-muted/60 animate-pulse" />
              <div
                className="h-4 flex-1 rounded bg-muted/60 animate-pulse"
                style={{ maxWidth: "120px" }}
              />
              <div className="h-5 w-5 rounded-full bg-primary/10 animate-pulse" />
            </div>
            <div className="space-y-1 pl-2">
              {Array.from({ length: 2 }).map((_, prIdx) => (
                <div key={prIdx} className="rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-4 w-4 rounded bg-muted/50 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-3/4 rounded bg-muted/50 animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-3 w-10 rounded bg-muted/40 animate-pulse" />
                        <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <div className="h-3 w-8 rounded bg-green-400/20 animate-pulse" />
                    <div className="h-3 w-8 rounded bg-red-400/20 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <GitPullRequest className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">No repositories</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Add repositories to see their pull requests
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      {repositories.map((repo) => {
        const prs = pullRequestsByRepo.get(repo.fullName) ?? [];
        const isExpanded = expandedRepos.has(repo.fullName);
        const openPRs = prs.filter((pr) => pr.state === "open");

        return (
          <div key={repo.id} className="mb-4 min-w-0">
            <button
              type="button"
              onClick={() => toggleRepo(repo.fullName)}
              className={cn(
                "group flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg px-2 py-2 text-sm font-medium",
                "transition-colors duration-200",
                "hover:bg-glass-highlight",
              )}
            >
              <span className="text-muted-foreground transition-transform duration-200">
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </span>

              <span className="min-w-0 flex-1 truncate text-left text-foreground/90">
                {repo.name}
              </span>

              {openPRs.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {openPRs.length}
                </span>
              )}

              {onRemoveRepo && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRepo(repo.fullName);
                  }}
                >
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              )}
            </button>

            {isExpanded && (
              <div className="mt-1 min-w-0 space-y-0.5 pl-2">
                {prs.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground/70">
                    No open pull requests
                  </p>
                ) : (
                  prs.map((pr) => (
                    <PRListItem
                      key={pr.id}
                      pr={pr}
                      isSelected={selectedPR?.id === pr.id}
                      onClick={() => onSelectPR(pr)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { PRList };
