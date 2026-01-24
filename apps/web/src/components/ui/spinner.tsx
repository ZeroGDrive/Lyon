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
 */
function Spinner({ className, size = "md" }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />;
}

export { Spinner };
