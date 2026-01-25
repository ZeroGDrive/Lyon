import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

interface SidebarProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

function Sidebar({ children, className, header, footer }: SidebarProps) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "relative flex h-full w-[280px] shrink-0 flex-col",
        "bg-sidebar backdrop-blur-[var(--glass-blur)] backdrop-saturate-[1.8]",
        "border-r border-sidebar-border",
        "transition-all duration-300 ease-out",
        className,
      )}
    >
      {/* Glossy highlight at top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, var(--glass-highlight) 20%, var(--glass-highlight) 80%, transparent)",
        }}
      />

      {header && (
        <div
          data-slot="sidebar-header"
          className="relative flex shrink-0 items-center border-b border-sidebar-border/50 px-4 py-3"
        >
          {header}
        </div>
      )}

      <ScrollArea className="min-w-0 flex-1">
        <nav data-slot="sidebar-content" className="min-w-0 px-3 py-3">
          {children}
        </nav>
      </ScrollArea>

      {footer && (
        <div
          data-slot="sidebar-footer"
          className="shrink-0 border-t border-sidebar-border/50 px-4 py-3"
        >
          {footer}
        </div>
      )}

      {/* Right edge highlight */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-px"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--glass-highlight) 20%, var(--glass-highlight) 80%, transparent)",
        }}
      />

      {/* Subtle inner glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at top left, var(--orb-1) 0%, transparent 50%)",
          opacity: 0.3,
        }}
      />
    </aside>
  );
}

interface SidebarSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

function SidebarSection({ children, title, className }: SidebarSectionProps) {
  return (
    <div data-slot="sidebar-section" className={cn("mb-6", className)}>
      {title && (
        <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {title}
        </h3>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface SidebarItemProps {
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  badge?: ReactNode;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function SidebarItem({
  children,
  icon,
  active,
  badge,
  className,
  onClick,
  loading,
  disabled,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-item"
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
        "transition-all duration-200 ease-out",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground",
        "hover:bg-sidebar-accent/60 hover:backdrop-blur-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        active && [
          "bg-sidebar-accent text-sidebar-foreground",
          "shadow-sm",
        ],
        className,
      )}
    >
      {active && (
        <div
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
          style={{
            boxShadow: "0 0 12px 2px oklch(from var(--primary) l c h / 50%)",
          }}
        />
      )}

      {/* Glossy top highlight for active state */}
      {active && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg"
          style={{
            background: "linear-gradient(90deg, transparent 10%, var(--glass-highlight) 50%, transparent 90%)",
          }}
        />
      )}

      {loading ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Spinner size="sm" className="text-primary" />
        </span>
      ) : icon ? (
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-200",
            active ? "text-primary" : "text-muted-foreground",
            "group-hover:text-primary",
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1 truncate text-left">{children}</span>

      {badge && (
        <span className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {badge}
        </span>
      )}
    </button>
  );
}

export { Sidebar, SidebarSection, SidebarItem };
