import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MainContentProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
}

function MainContent({ children, className, header }: MainContentProps) {
  return (
    <main
      data-slot="main-content"
      className={cn("relative flex flex-1 flex-col overflow-hidden", className)}
    >
      {header && (
        <div
          data-slot="main-header"
          className={cn("glass-subtle shrink-0 border-b border-glass-border-subtle", "px-6 py-4")}
        >
          {header}
        </div>
      )}

      <ScrollArea orientation="vertical" data-slot="main-body" className="flex-1">
        {children}
      </ScrollArea>
    </main>
  );
}

interface ContentSectionProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

function ContentSection({ children, className, padded = true }: ContentSectionProps) {
  return (
    <section data-slot="content-section" className={cn(padded && "p-6", className)}>
      {children}
    </section>
  );
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "heavy";
}

function GlassCard({ children, className, variant = "default" }: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        "relative rounded-xl",
        variant === "default" && "glass",
        variant === "subtle" && "glass-subtle",
        variant === "heavy" && "glass-heavy",
        className,
      )}
    >
      {children}

      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background: "linear-gradient(135deg, var(--glass-highlight) 0%, transparent 50%)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

interface PageTitleProps {
  children: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

function PageTitle({ children, description, actions, className }: PageTitleProps) {
  return (
    <div data-slot="page-title" className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {children}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export { MainContent, ContentSection, GlassCard, PageTitle };
