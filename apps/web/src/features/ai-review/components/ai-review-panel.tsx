import type {
  AIProvider,
  AIReviewComment,
  AIReviewResult as AIReviewResultType,
} from "@/types";
import { CODEX_REASONING_EFFORTS, DEFAULT_SYSTEM_PROMPTS, MODELS_BY_PROVIDER } from "@/types";

import { formatDistanceToNow } from "date-fns";
import AlertCircle from "lucide-react/dist/esm/icons/circle-alert";
import Bot from "lucide-react/dist/esm/icons/bot";
import Check from "lucide-react/dist/esm/icons/check";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import Send from "lucide-react/dist/esm/icons/send";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Square from "lucide-react/dist/esm/icons/square";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import { useEffect, useMemo, useState } from "react";

import { GlassCard } from "@/components/layout/main-content";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useReviewStore } from "@/stores";

interface AIReviewPanelProps {
  prNumber: number;
  repository: string;
  onStartReview: (provider: AIProvider, model: string, systemPrompt: string) => void;
  onCancelReview?: () => void;
  isLoading?: boolean;
  onCommentClick?: (filePath: string, line: number) => void;
  onPostComment?: (comment: AIReviewComment) => Promise<boolean>;
}

function AIReviewPanel({
  prNumber,
  repository,
  onStartReview,
  onCancelReview,
  isLoading,
  onCommentClick,
  onPostComment,
}: AIReviewPanelProps) {
  const {
    config,
    setProvider,
    setModel,
    setReasoningEffort,
    setSystemPrompt,
    reviews,
    activeReviewByProvider,
  } = useReviewStore();
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState<string>("default");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const reviewFocusItems = [
    { value: "default", label: "General Review" },
    { value: "security", label: "Security Focused" },
    { value: "performance", label: "Performance Focused" },
    { value: "custom", label: "Custom Prompt" },
  ];

  const providerReviews = useMemo(
    () => reviews.filter((r) => r.prNumber === prNumber && r.repository === repository && r.provider === config.provider),
    [reviews, prNumber, repository, config.provider]
  );
  const activeReview = activeReviewByProvider[config.provider];
  const selectedReview = selectedReviewId
    ? (providerReviews.find((review) => review.id === selectedReviewId) ?? null)
    : null;
  const latestReview = selectedReview ?? providerReviews[0] ?? activeReview;

  const historyItems = useMemo(() => {
    return providerReviews.map((review) => {
      const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true });
      const score = review.overallScore ? ` • ${review.overallScore}/10` : "";
      return {
        value: review.id,
        label: `${timeAgo} • ${review.status}${score}`,
      };
    });
  }, [providerReviews]);

  const providers: AIProvider[] = ["claude", "codex"];

  const handleProviderChange = (provider: AIProvider) => {
    setProvider(provider);
  };

  const handleTemplateChange = (value: string | null) => {
    if (!value) return;
    setPromptTemplate(value);
    const prompt = value === "custom" ? config.systemPrompt : DEFAULT_SYSTEM_PROMPTS[value];
    if (prompt) {
      setSystemPrompt(prompt);
    }
  };

  const handleStartReview = () => {
    onStartReview(config.provider, config.model ?? "", config.systemPrompt);
  };

  useEffect(() => {
    if (providerReviews.length === 0) {
      setSelectedReviewId(null);
      return;
    }
    if (!selectedReviewId || !providerReviews.some((review) => review.id === selectedReviewId)) {
      setSelectedReviewId(providerReviews[0]?.id ?? null);
    }
  }, [providerReviews, selectedReviewId, config.provider, prNumber, repository]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <GlassCard className="shrink-0 p-4" variant="subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Review</h3>
          </div>
          {isLoading ? (
            <Button onClick={onCancelReview} size="sm" variant="outline">
              <Square className="mr-1.5 size-3.5" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleStartReview} size="sm">
              <Sparkles className="mr-1.5 size-3.5" />
              Start Review
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              AI Provider
            </label>
            <div className="flex gap-2">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => handleProviderChange(provider)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    config.provider === provider
                      ? "bg-primary text-primary-foreground"
                      : "bg-glass-bg-subtle text-muted-foreground hover:bg-glass-highlight hover:text-foreground",
                  )}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Model</label>
            <div className="flex flex-wrap gap-1.5">
              {MODELS_BY_PROVIDER[config.provider].map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setModel(model.id)}
                  title={model.description}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    config.model === model.id
                      ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-glass-bg-subtle text-muted-foreground hover:bg-glass-highlight hover:text-foreground",
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>

          {config.provider === "codex" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Reasoning Effort
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CODEX_REASONING_EFFORTS.map((effort) => (
                  <button
                    key={effort.id}
                    type="button"
                    onClick={() => setReasoningEffort(effort.id)}
                    title={effort.description}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      config.reasoningEffort === effort.id
                        ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                        : "bg-glass-bg-subtle text-muted-foreground hover:bg-glass-highlight hover:text-foreground",
                    )}
                  >
                    {effort.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Review Focus
            </label>
            <Select
              defaultValue={reviewFocusItems[0]}
              onValueChange={(item: { value: string; label: string } | null) => {
                if (item) handleTemplateChange(item.value);
              }}
              items={reviewFocusItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select focus area" />
              </SelectTrigger>
              <SelectContent>
                {reviewFocusItems.map((item) => (
                  <SelectItem key={item.value} value={item}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Collapsible open={showPromptEditor} onOpenChange={setShowPromptEditor}>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground">
              <span>Customize prompt</span>
              <ChevronDown
                className={cn("size-4 transition-transform", showPromptEditor && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Textarea
                value={config.systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="font-mono"
                placeholder="Enter your custom system prompt..."
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </GlassCard>

      {isLoading && (
        <GlassCard className="shrink-0 p-4" variant="subtle">
          <div className="flex items-center gap-3">
            <Spinner className="text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">AI is reviewing...</p>
              <p className="text-xs text-muted-foreground">
                This may take a minute. Using {config.provider}.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {!isLoading && historyItems.length > 1 && (
        <GlassCard className="shrink-0 p-4" variant="subtle">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Review history</p>
              <p className="text-xs text-muted-foreground">Switch between previous AI runs</p>
            </div>
            <div className="min-w-[220px]">
              <Select
                value={historyItems.find((i) => i.value === (selectedReviewId ?? historyItems[0]?.value)) ?? historyItems[0]}
                onValueChange={(item: { value: string; label: string } | null) => {
                  if (item) setSelectedReviewId(item.value);
                }}
                items={historyItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a review" />
                </SelectTrigger>
                <SelectContent>
                  {historyItems.map((item) => (
                    <SelectItem key={item.value} value={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </GlassCard>
      )}

      {!isLoading && latestReview && (
        <ReviewResultCard
          review={latestReview}
          onCommentClick={onCommentClick}
          onPostComment={onPostComment}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}

interface AIReviewResultCardProps {
  review: AIReviewResultType;
  onCommentClick?: (filePath: string, line: number) => void;
  onPostComment?: (comment: AIReviewComment) => Promise<boolean>;
  className?: string;
}

function ReviewResultCard({
  review,
  onCommentClick,
  onPostComment,
  className,
}: AIReviewResultCardProps) {
  const statusIcon =
    review.status === "completed" ? (
      <CheckCircle className="size-4 text-foreground" />
    ) : review.status === "failed" ? (
      <XCircle className="size-4 text-muted-foreground" />
    ) : review.status === "running" ? (
      <Spinner size="xs" className="text-foreground" />
    ) : (
      <AlertCircle className="size-4 text-muted-foreground" />
    );

  return (
    <GlassCard className={cn("flex flex-col overflow-hidden p-4", className)} variant="subtle">
      <div className="flex shrink-0 items-center justify-between border-b border-glass-border-subtle pb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium capitalize text-foreground">{review.status}</span>
        </div>
        {review.overallScore && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Score:</span>
            <span className="text-sm font-semibold text-foreground">{review.overallScore}/10</span>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="pr-3">
          {review.summary && (
            <div className="mt-3">
              <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Summary</h4>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{review.summary}</p>
            </div>
          )}

          {review.comments.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                Comments ({review.comments.length})
              </h4>
              <ReviewCommentsGrouped
                comments={review.comments}
                onCommentClick={onCommentClick}
                onPostComment={onPostComment}
              />
            </div>
          )}

          {review.status === "completed" &&
            !review.summary &&
            review.comments.length === 0 &&
            !review.error && (
              <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
                Review completed but no structured feedback was generated. The AI may have responded
                in an unexpected format.
              </div>
            )}

          {review.error && (
            <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              <p className="font-medium mb-1">Error</p>
              <p className="whitespace-pre-wrap">{review.error}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </GlassCard>
  );
}

interface ReviewCommentsGroupedProps {
  comments: AIReviewComment[];
  onCommentClick?: (filePath: string, line: number) => void;
  onPostComment?: (comment: AIReviewComment) => Promise<boolean>;
}

function ReviewCommentsGrouped({
  comments,
  onCommentClick,
  onPostComment,
}: ReviewCommentsGroupedProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);
  const [postedCommentIds, setPostedCommentIds] = useState<Set<string>>(new Set());
  const [isPostingAll, setIsPostingAll] = useState(false);

  const commentsByFile = useMemo(() => {
    const grouped = new Map<string, AIReviewComment[]>();
    for (const comment of comments) {
      const existing = grouped.get(comment.path) ?? [];
      existing.push(comment);
      grouped.set(comment.path, existing);
    }
    return grouped;
  }, [comments]);

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handlePostComment = async (comment: AIReviewComment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onPostComment || postingCommentId || postedCommentIds.has(comment.id)) return;

    setPostingCommentId(comment.id);
    const success = await onPostComment(comment);
    if (success) {
      setPostedCommentIds((prev) => new Set(prev).add(comment.id));
    }
    setPostingCommentId(null);
  };

  const handlePostAll = async () => {
    if (!onPostComment || isPostingAll) return;
    const pendingComments = comments.filter((comment) => !postedCommentIds.has(comment.id));
    if (pendingComments.length === 0) return;

    setIsPostingAll(true);
    for (const comment of pendingComments) {
      setPostingCommentId(comment.id);
      const success = await onPostComment(comment);
      if (success) {
        setPostedCommentIds((prev) => new Set(prev).add(comment.id));
      }
    }
    setPostingCommentId(null);
    setIsPostingAll(false);
  };

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    suggestion: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const severityBorderColors: Record<string, string> = {
    critical: "border-red-500/50",
    warning: "border-yellow-500/50",
    info: "border-blue-500/50",
    suggestion: "border-green-500/50",
  };

  return (
    <div className="space-y-2">
      {onPostComment && comments.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-glass-border-subtle bg-glass-bg-subtle/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">
            {postedCommentIds.size}/{comments.length} posted
          </div>
          <button
            type="button"
            onClick={handlePostAll}
            disabled={isPostingAll || postedCommentIds.size === comments.length}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              postedCommentIds.size === comments.length
                ? "bg-green-500/20 text-green-400"
                : "bg-primary/10 text-primary hover:bg-primary/20",
              (isPostingAll || postedCommentIds.size === comments.length) && "cursor-default",
            )}
            title={
              postedCommentIds.size === comments.length
                ? "All comments posted"
                : "Post all comments to GitHub"
            }
          >
            {isPostingAll ? <Spinner size="xs" className="size-3" /> : <Send className="size-3" />}
            {isPostingAll
              ? "Posting..."
              : postedCommentIds.size === comments.length
                ? "Posted"
                : "Post all"}
          </button>
        </div>
      )}
      {Array.from(commentsByFile.entries()).map(([filePath, fileComments]) => {
        const isExpanded = expandedFiles.has(filePath);
        const fileName = filePath.split("/").pop() ?? filePath;
        const criticalCount = fileComments.filter((c) => c.severity === "critical").length;
        const warningCount = fileComments.filter((c) => c.severity === "warning").length;

        return (
          <div
            key={filePath}
            className="rounded-lg border border-glass-border-subtle bg-glass-bg-subtle/50"
          >
            <button
              type="button"
              onClick={() => toggleFile(filePath)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-glass-highlight"
            >
              {isExpanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
              <FileCode2 className="size-4 shrink-0 text-primary" />
              <span className="flex-1 truncate font-mono text-xs text-foreground">{fileName}</span>
              <div className="flex items-center gap-1.5">
                {criticalCount > 0 && (
                  <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                    {criticalCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                    {warningCount}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {fileComments.length} {fileComments.length === 1 ? "comment" : "comments"}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-glass-border-subtle">
                {fileComments
                  .toSorted((a, b) => a.line - b.line)
                  .map((comment) => {
                    const isPosting = postingCommentId === comment.id;
                    const isPosted = postedCommentIds.has(comment.id);

                    return (
                      <div
                        key={comment.id}
                        className={cn(
                          "border-l-2 px-3 py-2 transition-colors hover:bg-glass-highlight",
                          severityBorderColors[comment.severity] ?? "border-muted-foreground/30",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onCommentClick?.(comment.path, comment.line)}
                            className="flex items-center gap-2"
                          >
                            <span className="font-mono text-[10px] text-muted-foreground">
                              Line {comment.line}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                severityColors[comment.severity] ??
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {comment.severity}
                            </span>
                          </button>
                          {onPostComment && (
                            <button
                              type="button"
                              onClick={(e) => handlePostComment(comment, e)}
                              disabled={isPosting || isPosted}
                              className={cn(
                                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                                isPosted
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-primary/10 text-primary hover:bg-primary/20",
                                (isPosting || isPosted) && "cursor-default",
                              )}
                              title={isPosted ? "Posted to GitHub" : "Post comment to GitHub"}
                            >
                              {isPosting ? (
                                <Spinner size="xs" className="size-3" />
                              ) : isPosted ? (
                                <Check className="size-3" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              {isPosted ? "Posted" : isPosting ? "Posting..." : "Post"}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onCommentClick?.(comment.path, comment.line)}
                          className="w-full text-left"
                        >
                          <p className="text-xs text-foreground/80">{comment.body}</p>
                          {comment.suggestion && (
                            <div className="mt-2 rounded bg-glass-bg p-2">
                              <p className="font-mono text-[10px] text-muted-foreground">
                                Suggestion:
                              </p>
                              <pre className="mt-1 whitespace-pre-wrap text-[10px] text-foreground/70">
                                {comment.suggestion}
                              </pre>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { AIReviewPanel, ReviewResultCard };
