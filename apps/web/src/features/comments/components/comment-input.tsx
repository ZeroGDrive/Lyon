import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommentInputProps {
  onSubmit: (body: string) => void;
  placeholder?: string;
  submitLabel?: string;
  isLoading?: boolean;
  className?: string;
  autoFocus?: boolean;
}

function CommentInput({
  onSubmit,
  placeholder = "Add a comment...",
  submitLabel = "Comment",
  isLoading,
  className,
  autoFocus,
}: CommentInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        autoFocus={autoFocus}
        className={cn(
          "min-h-[80px] w-full resize-none rounded-lg border border-glass-border bg-glass-bg-subtle p-3",
          "text-sm text-foreground placeholder:text-muted-foreground",
          "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!value.trim() || isLoading}>
          <Send className="mr-1.5 size-3.5" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { CommentInput };
