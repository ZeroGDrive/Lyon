export type AIProvider = "claude" | "codex";

export type ClaudeModel = "claude-sonnet-4-20250514" | "claude-opus-4-20250514";
export type CodexModel = "o3" | "o4-mini" | "codex-1";

export interface AIModelConfig {
  id: string;
  name: string;
  description: string;
}

export const CLAUDE_MODELS: AIModelConfig[] = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Fast and efficient" },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "Most capable" },
];

export const CODEX_MODELS: AIModelConfig[] = [
  { id: "o4-mini", name: "o4-mini", description: "Fast and efficient" },
  { id: "o3", name: "o3", description: "Most capable" },
  { id: "codex-1", name: "Codex 1", description: "Optimized for code" },
];

export const MODELS_BY_PROVIDER: Record<AIProvider, AIModelConfig[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  claude: "claude-sonnet-4-20250514",
  codex: "o4-mini",
};

export interface AIReviewConfig {
  provider: AIProvider;
  model?: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIReviewRequest {
  prNumber: number;
  repository: string;
  config: AIReviewConfig;
  focusAreas?: ReviewFocusArea[];
  includeFiles?: string[];
  excludeFiles?: string[];
}

export type ReviewFocusArea =
  | "security"
  | "performance"
  | "best-practices"
  | "code-style"
  | "documentation"
  | "testing"
  | "architecture"
  | "all";

export interface AIReviewResult {
  id: string;
  prNumber: number;
  repository: string;
  provider: AIProvider;
  status: ReviewStatus;
  summary: string | null;
  comments: AIReviewComment[];
  suggestions: AIReviewSuggestion[];
  overallScore?: number;
  createdAt: string;
  completedAt: string | null;
  error?: string;
}

export type ReviewStatus = "pending" | "running" | "completed" | "failed";

export interface AIReviewComment {
  id: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  severity: CommentSeverity;
  category: ReviewFocusArea;
  body: string;
  suggestion?: string;
}

export type CommentSeverity = "critical" | "warning" | "info" | "suggestion";

export interface AIReviewSuggestion {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  suggestedCode: string;
  explanation: string;
  category: ReviewFocusArea;
}

export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  default: `You are an expert code reviewer. Review the pull request changes and provide:
1. A brief summary of the changes
2. Potential issues or bugs
3. Security concerns
4. Performance considerations
5. Code style and best practices suggestions

Be constructive and specific. Reference line numbers when commenting on specific code.`,

  security: `You are a security-focused code reviewer. Analyze the changes for:
1. SQL injection vulnerabilities
2. XSS vulnerabilities
3. Authentication/authorization issues
4. Sensitive data exposure
5. Input validation problems
6. Dependency vulnerabilities

Flag any security concerns with severity levels.`,

  performance: `You are a performance-focused code reviewer. Analyze the changes for:
1. Algorithmic complexity issues
2. Memory leaks or excessive allocations
3. N+1 query problems
4. Unnecessary re-renders (for frontend)
5. Missing caching opportunities
6. Blocking operations

Suggest optimizations where applicable.`,
};
