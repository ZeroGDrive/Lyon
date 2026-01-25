import type { PullRequest } from "@/types";

import GitMerge from "lucide-react/dist/esm/icons/git-merge";
import GitPullRequest from "lucide-react/dist/esm/icons/git-pull-request";
import GitPullRequestClosed from "lucide-react/dist/esm/icons/git-pull-request-closed";
import GitPullRequestDraft from "lucide-react/dist/esm/icons/git-pull-request-draft";

import { cn } from "@/lib/utils";

interface PRListItemProps {
  pr: PullRequest;
  isSelected?: boolean;
  onClick?: () => void;
}

function PRListItem({ pr, isSelected, onClick }: PRListItemProps) {
  const icon = pr.draft ? (
    <GitPullRequestDraft className="size-4" />
  ) : pr.state === "merged" ? (
    <GitMerge className="size-4" />
  ) : pr.state === "closed" ? (
    <GitPullRequestClosed className="size-4" />
  ) : (
    <GitPullRequest className="size-4" />
  );

  const stateColor = pr.draft
    ? "text-muted-foreground"
    : pr.state === "merged"
      ? "text-purple-400"
      : pr.state === "closed"
        ? "text-red-400"
        : "text-green-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl px-4 py-3 text-left",
        "transition-all duration-200 ease-out",
        "hover:bg-glass-highlight",
        isSelected && ["bg-glass-highlight", "shadow-sm shadow-glass-shadow"],
      )}
    >
      {isSelected && (
        <div
          className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
          style={{ boxShadow: "0 0 12px 2px var(--primary)" }}
        />
      )}

      <div className="flex min-w-0 items-start gap-2">
        <span className={cn("mt-0.5 shrink-0", stateColor)}>{icon}</span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <h4 className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
            {pr.title}
          </h4>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>#{pr.number}</span>
            <span>by {pr.author.login}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
        {(pr.additions > 0 || pr.deletions > 0) && (
          <>
            <span className="text-green-400">+{pr.additions}</span>
            <span className="text-red-400">-{pr.deletions}</span>
          </>
        )}

        {pr.labels.length > 0 && (
          <div className="flex gap-1">
            {pr.labels.slice(0, 2).map((label) => (
              <span
                key={label.id}
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor: `#${label.color}20`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export { PRListItem };
