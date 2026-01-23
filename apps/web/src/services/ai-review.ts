import type { AIProvider, AIReviewConfig, AIReviewResult, ReviewStatus } from "@/types";

interface StreamCallbacks {
  onThinkingStart: () => void;
  onThinkingDelta: (text: string) => void;
  onTextDelta: (text: string) => void;
  onBlockStop: () => void;
  onComplete: (fullOutput: string) => void;
  onError: (error: string) => void;
}

interface AIStreamEvent {
  process_id: string;
  event_type: "stdout" | "stderr" | "complete" | "error" | "cancelled";
  data: string;
}

interface AIContentEvent {
  process_id: string;
  event_type: "thinking_start" | "thinking_delta" | "text_delta" | "block_stop";
  text: string;
}

interface PRInfo {
  number: number;
  repository: string;
}

function getProviderCommand(provider: AIProvider): string {
  switch (provider) {
    case "claude":
      return "claude";
    case "codex":
      return "codex";
  }
}

interface ProviderConfig {
  args: string[];
  useStdin: boolean;
}

function getProviderConfig(
  provider: AIProvider,
  model: string | undefined,
  reasoningEffort: string | undefined,
  prompt: string,
): ProviderConfig {
  switch (provider) {
    case "claude": {
      // Use json output format - simpler and more reliable than stream-json
      // The CLI will output the final result as JSON when complete
      const args = ["-p", prompt, "--allowedTools", "Bash(gh:*)", "--output-format", "json"];
      if (model) {
        args.unshift("--model", model);
      }
      return { args, useStdin: false };
    }
    case "codex": {
      // Use exec subcommand for non-interactive mode with JSON output
      // --sandbox danger-full-access allows network access for gh CLI
      const args = ["exec", "--json", "--skip-git-repo-check", "--sandbox", "danger-full-access"];
      if (model) {
        args.push("--model", model);
      }
      if (reasoningEffort) {
        args.push("-c", `model_reasoning_effort="${reasoningEffort}"`);
      }
      args.push(prompt);
      return { args, useStdin: false };
    }
  }
}

export async function startStreamingAIReview(
  prInfo: PRInfo,
  config: AIReviewConfig,
  callbacks: StreamCallbacks,
): Promise<() => Promise<void>> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  const command = getProviderCommand(config.provider);
  const prompt = buildReviewPrompt(prInfo, config.systemPrompt);
  const providerConfig = getProviderConfig(config.provider, config.model, config.reasoningEffort, prompt);
  const processId = crypto.randomUUID();

  console.log("[AI Review] Starting review with provider:", config.provider, "model:", config.model, "reasoning:", config.reasoningEffort);
  console.log("[AI Review] Command:", command);
  console.log("[AI Review] PR:", prInfo.repository, "#", prInfo.number);

  // Use a state object to track cleanup and prevent memory leaks
  const state = {
    fullOutput: "",
    stderrOutput: "",
    processId,
    unlistenStream: null as (() => void) | null,
    unlistenContent: null as (() => void) | null,
    isCleanedUp: false,
  };

  const cleanup = () => {
    if (state.isCleanedUp) return;
    state.isCleanedUp = true;

    // Remove event listeners
    state.unlistenStream?.();
    state.unlistenContent?.();

    // Nullify references to help GC
    state.unlistenStream = null;
    state.unlistenContent = null;
    state.fullOutput = "";
    state.stderrOutput = "";
  };

  try {
    // Set up event listeners first
    state.unlistenStream = await listen<AIStreamEvent>("ai-stream", (event) => {
      // Skip if already cleaned up or different process
      if (state.isCleanedUp) return;
      if (event.payload.process_id !== state.processId) return;

      console.log("[AI Review] Stream event:", event.payload.event_type, event.payload.data?.slice(0, 200));

      switch (event.payload.event_type) {
        case "stdout":
          console.log("[AI Review] stdout:", event.payload.data);
          break;
        case "stderr":
          console.warn("[AI Review] stderr:", event.payload.data);
          state.stderrOutput += event.payload.data + "\n";
          break;
        case "complete": {
          console.log("[AI Review] Process complete. Output length:", state.fullOutput.length);
          const output = state.fullOutput;
          cleanup();
          callbacks.onComplete(output);
          break;
        }
        case "error": {
          console.error("[AI Review] Process error:", event.payload.data);
          const errorMsg = state.stderrOutput.trim()
            ? `${event.payload.data}\n\nStderr:\n${state.stderrOutput.trim()}`
            : state.fullOutput.trim()
              ? `${event.payload.data}\n\nOutput:\n${state.fullOutput.trim()}`
              : event.payload.data;
          cleanup();
          callbacks.onError(errorMsg);
          break;
        }
        case "cancelled":
          console.log("[AI Review] Process cancelled");
          cleanup();
          callbacks.onError("Review cancelled");
          break;
      }
    });

    state.unlistenContent = await listen<AIContentEvent>("ai-content", (event) => {
      // Skip if already cleaned up or different process
      if (state.isCleanedUp) return;
      if (event.payload.process_id !== state.processId) return;

      console.log("[AI Review] Content event:", event.payload.event_type, "text length:", event.payload.text?.length ?? 0);

      switch (event.payload.event_type) {
        case "thinking_start":
          console.log("[AI Review] Thinking started");
          callbacks.onThinkingStart();
          break;
        case "thinking_delta":
          state.fullOutput += event.payload.text;
          callbacks.onThinkingDelta(event.payload.text);
          break;
        case "text_delta":
          state.fullOutput += event.payload.text;
          callbacks.onTextDelta(event.payload.text);
          break;
        case "block_stop":
          console.log("[AI Review] Block stopped. Total output so far:", state.fullOutput.length);
          callbacks.onBlockStop();
          break;
      }
    });

    // Start the process
    console.log("[AI Review] Invoking start_ai_stream...");
    const returnedId = await invoke<string>("start_ai_stream", {
      command,
      args: providerConfig.args,
      stdinInput: providerConfig.useStdin ? prompt : null,
      processId,
    });
    if (returnedId !== processId) {
      console.warn("[AI Review] Process ID mismatch:", returnedId, processId);
    }
    console.log("[AI Review] Process started with ID:", returnedId);

  } catch (error) {
    console.error("[AI Review] Failed to start process:", error);
    cleanup();
    callbacks.onError(error instanceof Error ? error.message : String(error));
    return async () => {};
  }

  // Return cancel function
  return async () => {
    if (state.isCleanedUp) return;

    if (state.processId) {
      try {
        await invoke("cancel_ai_stream", { processId: state.processId });
      } catch {
        // Ignore errors when cancelling (process might have already completed)
      }
    }
    cleanup();
  };
}

function buildReviewPrompt(prInfo: PRInfo, systemPrompt: string): string {
  return `${systemPrompt}

Review Pull Request #${prInfo.number} in repository ${prInfo.repository}.

First, fetch the PR details and diff using the gh CLI:
- Run: gh pr view ${prInfo.number} --repo ${prInfo.repository} --json title,body,files,additions,deletions
- Run: gh pr diff ${prInfo.number} --repo ${prInfo.repository}

After reviewing the changes, respond with ONLY a valid JSON object (no markdown, no code blocks, no extra text):

{
  "summary": "Brief summary of the changes and your overall assessment",
  "overallScore": 8,
  "comments": [
    {
      "path": "path/to/file.ts",
      "line": 42,
      "severity": "critical|warning|info|suggestion",
      "category": "security|performance|best-practices|code-style|documentation|testing|architecture",
      "body": "Your comment explaining the issue",
      "suggestion": "Optional: code fix suggestion"
    }
  ],
  "suggestions": []
}

If there are no issues, use an empty comments array. Start your response with { and end with }`;
}

function extractJsonFromResponse(response: string): string | null {
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    const jsonInBlock = codeBlockMatch[1].trim();
    if (jsonInBlock.startsWith("{")) {
      return jsonInBlock;
    }
  }

  const jsonObjectMatch = response.match(/(\{[\s\S]*"summary"[\s\S]*\})/);
  if (jsonObjectMatch?.[1]) {
    let depth = 0;
    let start = response.indexOf(jsonObjectMatch[1]);
    let end = start;

    for (let i = start; i < response.length; i++) {
      if (response[i] === "{") depth++;
      if (response[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (depth === 0) {
      return response.slice(start, end);
    }
  }

  const simpleMatch = response.match(/\{[\s\S]*\}/);
  return simpleMatch?.[0] ?? null;
}

export function parseAIReviewResponse(
  response: string,
  prNumber: number,
  repository: string,
  provider: AIProvider,
): AIReviewResult {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const jsonString = extractJsonFromResponse(response);

    if (!jsonString) {
      console.warn("No JSON found in AI response. Raw response:", response.slice(0, 500));
      return {
        id,
        prNumber,
        repository,
        provider,
        status: "completed",
        summary: response.length > 0 ? response : "No response received from AI",
        comments: [],
        suggestions: [],
        createdAt: now,
        completedAt: now,
      };
    }

    const parsed = JSON.parse(jsonString) as {
      summary?: string;
      overallScore?: number;
      comments?: AIReviewResult["comments"];
      suggestions?: AIReviewResult["suggestions"];
    };

    return {
      id,
      prNumber,
      repository,
      provider,
      status: "completed",
      summary: parsed.summary ?? null,
      overallScore: parsed.overallScore,
      comments: (parsed.comments ?? []).map((c, i) => ({
        ...c,
        id: `${id}-comment-${i}`,
        side: "RIGHT" as const,
      })),
      suggestions: (parsed.suggestions ?? []).map((s, i) => ({
        ...s,
        id: `${id}-suggestion-${i}`,
      })),
      createdAt: now,
      completedAt: now,
    };
  } catch (err) {
    console.error("Failed to parse AI response:", err);
    console.warn("Raw response:", response.slice(0, 500));
    return {
      id,
      prNumber,
      repository,
      provider,
      status: "completed",
      summary: response.length > 0 ? `Failed to parse response: ${response.slice(0, 200)}...` : "No response received",
      comments: [],
      suggestions: [],
      createdAt: now,
      completedAt: now,
    };
  }
}

export function createPendingReview(
  prNumber: number,
  repository: string,
  provider: AIProvider,
): AIReviewResult {
  return {
    id: crypto.randomUUID(),
    prNumber,
    repository,
    provider,
    status: "pending" as ReviewStatus,
    summary: null,
    comments: [],
    suggestions: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export interface AIProviderStatus {
  installed: boolean;
  authenticated: boolean;
  error?: string;
}

/**
 * Check if an AI provider CLI is installed and ready to use
 */
export async function checkProviderStatus(provider: AIProvider): Promise<AIProviderStatus> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const command = getProviderCommand(provider);

    // Check if installed
    try {
      await invoke<string>("run_shell_command", { command: "which", args: [command] });
    } catch {
      return {
        installed: false,
        authenticated: false,
        error: `${command} CLI is not installed`,
      };
    }

    // Check if authenticated by running a simple command
    try {
      if (provider === "claude") {
        // Claude: try to get config or run a simple check
        await invoke<string>("run_shell_command", {
          command,
          args: ["--version"],
        });
        // Claude doesn't have an easy auth check, assume authenticated if installed
        return { installed: true, authenticated: true };
      } else if (provider === "codex") {
        // Codex: check version
        await invoke<string>("run_shell_command", {
          command,
          args: ["--version"],
        });
        return { installed: true, authenticated: true };
      }
      return { installed: true, authenticated: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("not logged in") || errorMsg.includes("auth") || errorMsg.includes("API key")) {
        return {
          installed: true,
          authenticated: false,
          error: `${command} CLI is not authenticated. Please run "${command} auth" to authenticate.`,
        };
      }
      // If version check fails, it might still work
      return { installed: true, authenticated: true };
    }
  } catch (error) {
    return {
      installed: false,
      authenticated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkProviderAvailability(provider: AIProvider): Promise<boolean> {
  const status = await checkProviderStatus(provider);
  return status.installed && status.authenticated;
}
