import { useEffect, useRef } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import Download from "lucide-react/dist/esm/icons/download";
import FileText from "lucide-react/dist/esm/icons/file-text";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";

const DISMISSED_VERSION_KEY = "update-dismissed-version";
const AUTO_RELAUNCH = true;

interface PreflightResult {
  can_update: boolean;
  app_path: string;
  issue: string | null;
}

export function UpdateChecker() {
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAndDownload() {
      try {
        // Pre-flight: verify the app can be updated in-place
        console.info("[updater] Running pre-flight checks...");
        const preflight = await invoke<PreflightResult>(
          "check_update_preflight",
        );
        console.info("[updater] App path:", preflight.app_path);

        if (!preflight.can_update) {
          console.warn("[updater] Pre-flight failed:", preflight.issue);
          toast.error("Cannot auto-update", {
            description: preflight.issue ?? "Unknown issue",
            duration: 10000,
            action: {
              label: "Download",
              onClick: () =>
                window.open(
                  "https://github.com/ZeroGDrive/Lyon/releases/latest",
                  "_blank",
                ),
            },
          });
          return;
        }

        console.info("[updater] Pre-flight passed, checking for updates...");
        const update = await check();

        if (!update || cancelled) {
          console.info("[updater] No update available");
          return;
        }

        console.info("[updater] Update available:", update.version);

        // Check if user dismissed this version
        const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
        if (dismissedVersion === update.version) {
          console.info("[updater] Version dismissed by user");
          return;
        }

        // Show progress while the update downloads and installs
        toastIdRef.current = toast.custom(
          () => (
            <div className="relative w-full max-w-sm rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <RefreshCw className="size-4 animate-spin text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Downloading update</p>
                  <p className="text-xs text-muted-foreground">
                    This runs in the background
                  </p>
                </div>
              </div>
            </div>
          ),
          { duration: Infinity },
        );

        // Download and install the update
        console.info("[updater] Downloading and installing...");
        await update.downloadAndInstall();
        console.info("[updater] Download and install complete");

        if (cancelled) return;

        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = null;
        }

        if (AUTO_RELAUNCH) {
          toast.success("Update installed. Restarting...");
          console.info("[updater] Relaunching...");
          await relaunch();
          return;
        }

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
                  onClick={() => {
                    toast.dismiss(id);
                    relaunch();
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
      } catch (error) {
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = null;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error("[updater] Failed:", message, error);
        toast.error("Update failed", {
          description: message,
          action: {
            label: "Download",
            onClick: () =>
              window.open(
                "https://github.com/ZeroGDrive/Lyon/releases/latest",
                "_blank",
              ),
          },
        });
      }
    }

    // Check for updates on mount, but only in production
    if (!import.meta.env.DEV) {
      checkAndDownload();
    }

    return () => {
      cancelled = true;
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  return null;
}
