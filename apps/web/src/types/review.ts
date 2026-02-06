export type AIProvider = "claude" | "codex";

export interface AIModelConfig {
  id: string;
  name: string;
  description: string;
}

// Claude Code CLI models - use aliases for simplicity
// Full names: claude-sonnet-4-5-20250929, claude-opus-4-6, claude-haiku-4-5-20251001
export const CLAUDE_MODELS: AIModelConfig[] = [
  { id: "sonnet", name: "Sonnet 4.5", description: "Best for complex agents and coding" },
  { id: "opus", name: "Opus 4.6", description: "Most intelligent, maximum capability" },
  { id: "haiku", name: "Haiku 4.5", description: "Fastest, near-frontier performance" },
];

// Codex CLI models
export const CODEX_MODELS: AIModelConfig[] = [
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", description: "Most advanced agentic coding model" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", description: "Smaller, cost-effective" },
];

// Codex reasoning effort levels
export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface ReasoningEffortConfig {
  id: CodexReasoningEffort;
  name: string;
  description: string;
}

export const CODEX_REASONING_EFFORTS: ReasoningEffortConfig[] = [
  { id: "medium", name: "Medium", description: "Balanced speed and quality (recommended)" },
  { id: "high", name: "High", description: "Better answers, slower response" },
  { id: "xhigh", name: "Extra High", description: "Best for complex reasoning, slowest" },
  { id: "low", name: "Low", description: "Fastest, less thorough" },
];

export const MODELS_BY_PROVIDER: Record<AIProvider, AIModelConfig[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  claude: "sonnet",
  codex: "gpt-5.3-codex",
};

export const DEFAULT_REASONING_EFFORT: CodexReasoningEffort = "high";

export interface AIReviewConfig {
  provider: AIProvider;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
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
