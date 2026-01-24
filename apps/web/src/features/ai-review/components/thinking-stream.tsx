import Brain from "lucide-react/dist/esm/icons/brain";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import { parseAIStreamOutput, type ThinkingBlock } from "@/lib/thinking-parser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

interface ThinkingStreamProps {
  output: string;
  className?: string;
}

function ThinkingStream({ output, className }: ThinkingStreamProps) {
  const { thinkingBlocks, response, isThinking, toolCalls } = parseAIStreamOutput(output);

  if (thinkingBlocks.length === 0 && toolCalls.length === 0 && !response && !output) {
    return null;
  }

  const hasStructuredContent = thinkingBlocks.length > 0 || toolCalls.length > 0 || response;
  const showRawOutput = !hasStructuredContent && output;

  return (
    <div className={cn("space-y-2", className)}>
      {thinkingBlocks.map((block) => (
        <ThinkingBlockItem key={block.id} block={block} />
      ))}

      {toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {toolCalls.map((tool, i) => (
            <div
              key={`${tool.name}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-glass-bg-subtle px-2.5 py-1 text-xs"
            >
              {tool.status === "running" ? (
                <Spinner size="xs" className="size-3 text-primary" />
              ) : (
                <Wrench className="size-3 text-muted-foreground" />
              )}
              <span className="font-mono text-muted-foreground">{tool.name}</span>
            </div>
          ))}
        </div>
      )}

      {isThinking && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="xs" />
          <span>Thinking...</span>
        </div>
      )}

      {response && (
        <div className="mt-3 rounded-lg bg-glass-bg-subtle p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80">{response}</pre>
        </div>
      )}

      {showRawOutput && (
        <div className="rounded-lg bg-glass-bg-subtle p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80">{output}</pre>
        </div>
      )}
    </div>
  );
}

interface ThinkingBlockItemProps {
  block: ThinkingBlock;
}

const ThinkingBlockItem = memo(function ThinkingBlockItem({ block }: ThinkingBlockItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-glass-border-subtle bg-glass-bg-subtle/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-glass-highlight"
      >
        {isExpanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}

        {block.isComplete ? (
          <Brain className="size-3.5 text-primary/70" />
        ) : (
          <Spinner size="xs" className="size-3.5 text-primary" />
        )}

        <span className="flex-1 truncate font-medium text-foreground/80">{block.title}</span>

        {!block.isComplete && (
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            thinking
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-glass-border-subtle px-3 py-2">
          <ScrollArea orientation="vertical" className="max-h-48">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
              {block.content}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
});

export { ThinkingStream };
