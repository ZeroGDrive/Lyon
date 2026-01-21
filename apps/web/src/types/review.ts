export type AIProvider = "claude" | "codex";

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
