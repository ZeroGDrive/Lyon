import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  xs: "size-3",
  sm: "size-4",
  default: "size-5",
  lg: "size-6",
  xl: "size-8",
};

interface SpinnerProps extends Omit<React.ComponentProps<typeof Loader2Icon>, 'size'> {
  size?: keyof typeof sizeClasses;
}

function Spinner({
  className,
  size = "default",
  ...props
}: SpinnerProps) {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", sizeClasses[size], className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
