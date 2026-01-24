import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import type { ErrorLogSource } from "@/types/error-log";

import AlertTriangleIcon from "lucide-react/dist/esm/icons/alert-triangle";
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down";
import TerminalIcon from "lucide-react/dist/esm/icons/terminal";
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2";

import { useErrorLogStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ErrorLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sourceLabels: Record<ErrorLogSource | "all", string> = {
  all: "All Sources",
  gh: "GitHub CLI",
  "ai-claude": "Claude",
  "ai-codex": "Codex",
  system: "System",
};

const sourceColors: Record<ErrorLogSource, string> = {
  gh: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "ai-claude": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "ai-codex": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  system: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const filterItems = [
  { value: "all", label: "All Sources" },
  { value: "gh", label: "GitHub CLI" },
  { value: "ai-claude", label: "Claude" },
  { value: "ai-codex", label: "Codex" },
  { value: "system", label: "System" },
];

function ErrorLogViewer({ open, onOpenChange }: ErrorLogViewerProps) {
  const { logs, clearLogs } = useErrorLogStore();
  const [filter, setFilter] = useState<ErrorLogSource | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.source === filter);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const truncateError = (error: string, maxLength = 50) => {
    if (error.length <= maxLength) return error;
    return `${error.slice(0, maxLength)}...`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-destructive" />
            Error Logs
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pb-3 border-b border-glass-border-subtle">
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as ErrorLogSource | "all")}
            items={filterItems}
          >
            <SelectTrigger className="w-[160px]" size="sm">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              {filterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="destructive" size="sm" onClick={clearLogs} disabled={logs.length === 0}>
            <Trash2Icon data-icon="inline-start" />
            Clear All
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-4 px-4 min-h-0">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <TerminalIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No errors logged</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === "all"
                  ? "Errors from CLI commands will appear here"
                  : `No errors from ${sourceLabels[filter]}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filteredLogs.map((log) => {
                const isExpanded = expandedIds.has(log.id);
                return (
                  <Collapsible
                    key={log.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(log.id)}
                  >
                    <div className="rounded-lg border border-glass-border-subtle bg-glass-subtle overflow-hidden">
                      <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-start gap-3 text-left hover:bg-muted/30 transition-colors">
                        <ChevronDownIcon
                          className={cn(
                            "size-4 text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded",
                                sourceColors[log.source],
                              )}
                            >
                              {sourceLabels[log.source]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground font-mono truncate">
                            {truncateError(log.error)}
                          </p>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-glass-border-subtle bg-muted/20">
                          <div className="space-y-1">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Command
                            </span>
                            <p className="text-xs font-mono text-foreground bg-background/50 px-2 py-1.5 rounded border border-glass-border-subtle">
                              {log.command}
                            </p>
                          </div>

                          {log.args && log.args.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Arguments
                              </span>
                              <p className="text-xs font-mono text-foreground bg-background/50 px-2 py-1.5 rounded border border-glass-border-subtle break-all">
                                {log.args.join(" ")}
                              </p>
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Error
                            </span>
                            <p className="text-xs font-mono text-destructive bg-destructive/5 px-2 py-1.5 rounded border border-destructive/20 whitespace-pre-wrap break-all">
                              {log.error}
                            </p>
                          </div>

                          {log.stderr && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Stderr
                              </span>
                              <p className="text-xs font-mono text-muted-foreground bg-background/50 px-2 py-1.5 rounded border border-glass-border-subtle whitespace-pre-wrap break-all max-h-32 overflow-auto">
                                {log.stderr}
                              </p>
                            </div>
                          )}

                          {log.context && Object.keys(log.context).length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Context
                              </span>
                              <pre className="text-xs font-mono text-muted-foreground bg-background/50 px-2 py-1.5 rounded border border-glass-border-subtle whitespace-pre-wrap break-all max-h-32 overflow-auto">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export { ErrorLogViewer };
