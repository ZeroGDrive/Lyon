import type { ReactNode } from "react";

import { AnimatedBackground } from "@/components/animated-background";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

function AppLayout({ children, sidebar, className }: AppLayoutProps) {
  return (
    <div
      data-slot="app-layout"
      className={cn("relative flex h-svh w-full overflow-hidden", className)}
    >
      <AnimatedBackground />

      {sidebar}

      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export { AppLayout };
