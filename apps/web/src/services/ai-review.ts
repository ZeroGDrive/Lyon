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

function getProviderConfig(provider: AIProvider, prompt: string): ProviderConfig {
  switch (provider) {
    case "claude":
      // Use json output format - simpler and more reliable than stream-json
      // The CLI will output the final result as JSON when complete
      return {
        args: ["-p", prompt, "--allowedTools", "Bash(gh:*)", "--output-format", "json"],
        useStdin: false,
      };
    case "codex":
      // Use exec subcommand for non-interactive mode with JSON output
      // --sandbox danger-full-access allows network access for gh CLI
      return {
        args: ["exec", "--json", "--skip-git-repo-check", "--sandbox", "danger-full-access", prompt],
        useStdin: false,
      };
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
  const providerConfig = getProviderConfig(config.provider, prompt);

  console.log("[AI Review] Starting review with provider:", config.provider);
  console.log("[AI Review] Command:", command);
  console.log("[AI Review] PR:", prInfo.repository, "#", prInfo.number);
  console.log("[AI Review] Full prompt:\n", prompt);

  let fullOutput = "";
  let stderrOutput = "";
  let processId: string | null = null;
  let unlistenStream: (() => void) | null = null;
  let unlistenContent: (() => void) | null = null;

  const cleanup = () => {
    unlistenStream?.();
    unlistenContent?.();
  };

  const streamPromise = listen<AIStreamEvent>("ai-stream", (event) => {
    if (processId && event.payload.process_id !== processId) return;

    console.log("[AI Review] Stream event:", event.payload.event_type, event.payload.data?.slice(0, 200));

    switch (event.payload.event_type) {
      case "stdout":
        console.log("[AI Review] stdout:", event.payload.data);
        break;
      case "stderr":
        console.warn("[AI Review] stderr:", event.payload.data);
        stderrOutput += event.payload.data + "\n";
        break;
      case "complete":
        console.log("[AI Review] Process complete. Output length:", fullOutput.length);
        console.log("[AI Review] Full output preview:", fullOutput.slice(0, 500));
        callbacks.onComplete(fullOutput);
        cleanup();
        break;
      case "error": {
        console.error("[AI Review] Process error:", event.payload.data);
        console.error("[AI Review] stderr output:", stderrOutput);
        console.error("[AI Review] stdout output:", fullOutput);
        const errorMsg = stderrOutput.trim()
          ? `${event.payload.data}\n\nStderr:\n${stderrOutput.trim()}`
          : fullOutput.trim()
            ? `${event.payload.data}\n\nOutput:\n${fullOutput.trim()}`
            : event.payload.data;
        callbacks.onError(errorMsg);
        cleanup();
        break;
      }
      case "cancelled":
        console.log("[AI Review] Process cancelled");
        callbacks.onError("Review cancelled");
        cleanup();
        break;
    }
  });

  const contentPromise = listen<AIContentEvent>("ai-content", (event) => {
    if (processId && event.payload.process_id !== processId) return;

    console.log("[AI Review] Content event:", event.payload.event_type, "text length:", event.payload.text?.length ?? 0);

    switch (event.payload.event_type) {
      case "thinking_start":
        console.log("[AI Review] Thinking started");
        callbacks.onThinkingStart();
        break;
      case "thinking_delta":
        console.log("[AI Review] Thinking delta:", event.payload.text?.slice(0, 100));
        fullOutput += event.payload.text;
        callbacks.onThinkingDelta(event.payload.text);
        break;
      case "text_delta":
        console.log("[AI Review] Text delta:", event.payload.text?.slice(0, 100));
        fullOutput += event.payload.text;
        callbacks.onTextDelta(event.payload.text);
        break;
      case "block_stop":
        console.log("[AI Review] Block stopped. Total output so far:", fullOutput.length);
        callbacks.onBlockStop();
        break;
    }
  });

  try {
    unlistenStream = await streamPromise;
    unlistenContent = await contentPromise;
    console.log("[AI Review] Invoking start_ai_stream...");
    processId = await invoke<string>("start_ai_stream", {
      command,
      args: providerConfig.args,
      stdinInput: providerConfig.useStdin ? prompt : null,
    });
    console.log("[AI Review] Process started with ID:", processId);
  } catch (error) {
    console.error("[AI Review] Failed to start process:", error);
    cleanup();
    callbacks.onError(error instanceof Error ? error.message : String(error));
    return async () => {};
  }

  return async () => {
    if (processId) {
      await invoke("cancel_ai_stream", { processId }).catch(() => {});
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

export async function checkProviderAvailability(provider: AIProvider): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const command = getProviderCommand(provider);
    await invoke<string>("run_shell_command", { command: "which", args: [command] });
    return true;
  } catch {
    return false;
  }
}
