import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import Download from "lucide-react/dist/esm/icons/download";
import FileText from "lucide-react/dist/esm/icons/file-text";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";

const DISMISSED_VERSION_KEY = "update-dismissed-version";

export function UpdateChecker() {
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    async function checkAndDownload() {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) return;

        // Check if user dismissed this version
        const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
        if (dismissedVersion === update.version) return;

        // Download in background
        await update.downloadAndInstall();

        // Show toast when download is complete
        toastIdRef.current = toast.custom(
          (id) => (
            <div className="relative w-full max-w-sm rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Download className="size-4 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Update Ready</p>
                  <p className="text-xs text-muted-foreground">
                    Version {update.version} has been downloaded
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    toast.dismiss(id);
                    const { relaunch } = await import("@tauri-apps/plugin-process");
                    await relaunch();
                  }}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Restart
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    window.open(
                      `https://github.com/ZeroGDrive/Lyon/releases/tag/v${update.version}`,
                      "_blank",
                    );
                  }}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  Changelog
                </Button>
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  localStorage.setItem(DISMISSED_VERSION_KEY, update.version);
                  toast.dismiss(id);
                }}
              >
                <span className="sr-only">Dismiss</span>
                <X className="size-4" />
              </button>
            </div>
          ),
          { duration: Infinity },
        );
      } catch {
        // Silently fail - update check is not critical
      }
    }

    // Check for updates on mount, but only in production
    if (!import.meta.env.DEV) {
      // Small delay to let the app load first
      const timer = setTimeout(checkAndDownload, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  return null;
}
