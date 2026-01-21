export interface ThinkingBlock {
  id: string;
  title: string;
  content: string;
  isComplete: boolean;
}

export interface ParsedAIOutput {
  thinkingBlocks: ThinkingBlock[];
  response: string;
  isThinking: boolean;
  toolCalls: { name: string; status: "running" | "complete" }[];
}

interface ClaudeStreamEvent {
  type: string;
  message?: {
    id?: string;
    content?: Array<{ type: string; text?: string; thinking?: string }>;
  };
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
  };
  content_block?: {
    type: string;
    text?: string;
    thinking?: string;
  };
  index?: number;
}

interface CodexStreamEvent {
  type: string;
  message?: string;
  content?: string;
  thinking?: string;
  tool_use?: { name: string };
}

const IGNORED_EVENT_TYPES = new Set(["system", "init", "mcp_servers", "ping", "session"]);

const CONTENT_EVENT_TYPES = new Set([
  "message_start",
  "message_delta",
  "message_stop",
  "content_block_start",
  "content_block_delta",
  "content_block_stop",
]);

function isMetadataEvent(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;

  if ("mcp_servers" in obj) return true;
  if ("session" in obj || "session_id" in obj) return true;

  if ("type" in obj && typeof (obj as { type: unknown }).type === "string") {
    const type = (obj as { type: string }).type;
    if (IGNORED_EVENT_TYPES.has(type)) return true;
  }

  return false;
}

function isContentEvent(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;

  const event = obj as Record<string, unknown>;

  if ("type" in event && typeof event.type === "string") {
    return CONTENT_EVENT_TYPES.has(event.type);
  }

  if ("delta" in event || "content_block" in event) {
    return true;
  }

  return false;
}

export function parseStreamJsonOutput(lines: string[]): ParsedAIOutput {
  const thinkingBlocks: ThinkingBlock[] = [];
  const toolCalls: { name: string; status: "running" | "complete" }[] = [];
  let response = "";
  let isThinking = false;
  let currentThinking = "";
  let thinkingIndex = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line) as unknown;

      if (isMetadataEvent(parsed)) continue;
      if (!isContentEvent(parsed)) continue;

      const event = parsed as ClaudeStreamEvent | CodexStreamEvent;

      if ("delta" in event && event.delta) {
        if (event.delta.thinking) {
          currentThinking += event.delta.thinking;
          isThinking = true;
        }
        if (event.delta.text) {
          response += event.delta.text;
        }
      }

      if ("content_block" in event && event.content_block) {
        if (event.content_block.thinking) {
          currentThinking += event.content_block.thinking;
        }
        if (event.content_block.text) {
          response += event.content_block.text;
        }
      }

      if (event.type === "content_block_stop" && currentThinking) {
        thinkingBlocks.push({
          id: `thinking-${thinkingIndex++}`,
          title: extractThinkingTitle(currentThinking),
          content: currentThinking.trim(),
          isComplete: true,
        });
        currentThinking = "";
        isThinking = false;
      }

      if (
        "message" in event &&
        event.message &&
        typeof event.message === "object" &&
        "content" in event.message &&
        Array.isArray(event.message.content)
      ) {
        for (const block of event.message.content) {
          if (block.thinking) {
            thinkingBlocks.push({
              id: `thinking-${thinkingIndex++}`,
              title: extractThinkingTitle(block.thinking),
              content: block.thinking.trim(),
              isComplete: true,
            });
          }
          if (block.text) {
            response += block.text;
          }
        }
      }

      if ("tool_use" in event && (event as CodexStreamEvent).tool_use) {
        const toolEvent = event as CodexStreamEvent;
        if (toolEvent.tool_use?.name) {
          toolCalls.push({
            name: toolEvent.tool_use.name,
            status: "running",
          });
        }
      }
    } catch (_) {
      /* non-JSON lines are intentionally skipped */
    }
  }

  if (currentThinking) {
    thinkingBlocks.push({
      id: `thinking-${thinkingIndex}`,
      title: extractThinkingTitle(currentThinking),
      content: currentThinking.trim(),
      isComplete: false,
    });
    isThinking = true;
  }

  return {
    thinkingBlocks,
    response: response.trim(),
    isThinking,
    toolCalls,
  };
}

export function parseAIStreamOutput(output: string): ParsedAIOutput {
  const lines = output.split("\n").filter((l) => l.trim());

  const firstLine = lines[0]?.trim() ?? "";
  if (firstLine.startsWith("{") || firstLine.startsWith('{"')) {
    return parseStreamJsonOutput(lines);
  }

  return parsePlainTextOutput(output);
}

function parsePlainTextOutput(output: string): ParsedAIOutput {
  const thinkingBlocks: ThinkingBlock[] = [];
  let response = output;
  let isThinking = false;

  const thinkingRegex = /<thinking>([\s\S]*?)(<\/thinking>|$)/g;
  let match;
  let blockIndex = 0;

  while ((match = thinkingRegex.exec(output)) !== null) {
    const content = match[1] ?? "";
    const isComplete = match[2] === "</thinking>";

    const title = extractThinkingTitle(content);

    thinkingBlocks.push({
      id: `thinking-${blockIndex}`,
      title,
      content: content.trim(),
      isComplete,
    });

    if (!isComplete) {
      isThinking = true;
    }

    blockIndex++;
  }

  response = output.replace(/<thinking>[\s\S]*?(<\/thinking>|$)/g, "").trim();

  return {
    thinkingBlocks,
    response,
    isThinking,
    toolCalls: parseToolCalls(output),
  };
}

function extractThinkingTitle(content: string): string {
  const lines = content.trim().split("\n");
  const firstLine = lines[0]?.trim() ?? "";

  if (firstLine.length > 0 && firstLine.length <= 100) {
    return firstLine.replace(/^[#*\-]+\s*/, "").slice(0, 60) + (firstLine.length > 60 ? "..." : "");
  }

  const sentences = content.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences[0]) {
    const first = sentences[0].trim();
    return first.slice(0, 60) + (first.length > 60 ? "..." : "");
  }

  return "Analyzing...";
}

export function parseToolCalls(output: string): { name: string; status: "running" | "complete" }[] {
  const tools: { name: string; status: "running" | "complete" }[] = [];

  const toolCallRegex = /<function_calls>([\s\S]*?)(<\/function_calls>|$)/g;
  let match;

  while ((match = toolCallRegex.exec(output)) !== null) {
    const content = match[1] ?? "";
    const isComplete = match[2] === "</function_calls>";

    const invokeMatches = content.matchAll(/<invoke name="([^"]+)">/g);
    for (const invokeMatch of invokeMatches) {
      if (invokeMatch[1]) {
        tools.push({
          name: invokeMatch[1],
          status: isComplete ? "complete" : "running",
        });
      }
    }
  }

  return tools;
}
