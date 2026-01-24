import Loader2 from "lucide-react/dist/esm/icons/loader-2";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
  xl: "size-12",
} as const;

/**
 * Hardware-accelerated spinner component.
 * Animation is applied to wrapper div for GPU acceleration.
 */
function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <div className={cn("animate-spin", className)}>
      <Loader2 className={sizeClasses[size]} />
    </div>
  );
}

export { Spinner };
