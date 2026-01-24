import type { ToasterProps } from "sonner";

import CircleCheckIcon from "lucide-react/dist/esm/icons/check-circle";
import InfoIcon from "lucide-react/dist/esm/icons/info";
import OctagonXIcon from "lucide-react/dist/esm/icons/octagon-x";
import TriangleAlertIcon from "lucide-react/dist/esm/icons/triangle-alert";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

import { Spinner } from "@/components/ui/spinner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
