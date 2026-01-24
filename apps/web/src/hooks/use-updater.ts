import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

interface UpdateState {
  status: "idle" | "checking" | "downloading" | "ready" | "error";
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  error?: string;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    updateInfo: null,
    downloadProgress: 0,
  });

  const hasChecked = useRef(false);
  const toastId = useRef<string | number | null>(null);

  const restart = useCallback(async () => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      console.error("Failed to restart:", error);
    }
  }, []);

  const checkAndDownload = useCallback(async () => {
    if (state.status === "checking" || state.status === "downloading") return;

    setState((s) => ({ ...s, status: "checking" }));

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (!update?.available) {
        setState((s) => ({ ...s, status: "idle", updateInfo: null }));
        return;
      }

      const updateInfo: UpdateInfo = {
        version: update.version,
        date: update.date,
        body: update.body ?? undefined,
      };

      setState((s) => ({
        ...s,
        status: "downloading",
        updateInfo,
        downloadProgress: 0,
      }));

      // Show downloading toast
      toastId.current = toast.loading(`Downloading update v${update.version}...`, {
        duration: Infinity,
      });

      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            setState((s) => ({ ...s, downloadProgress: progress }));
          }
        }
      });

      // Dismiss downloading toast
      if (toastId.current) {
        toast.dismiss(toastId.current);
      }

      setState((s) => ({ ...s, status: "ready", downloadProgress: 100 }));

      // Show ready toast with restart button
      toast.success(`Update v${update.version} ready`, {
        description: "Restart to apply the update",
        duration: Infinity,
        action: {
          label: "Restart",
          onClick: restart,
        },
      });
    } catch (error) {
      // Dismiss any loading toast
      if (toastId.current) {
        toast.dismiss(toastId.current);
      }

      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setState((s) => ({ ...s, status: "error", error: errorMsg }));

      // Don't show error toast for common non-error cases
      if (!errorMsg.includes("No update available") && !errorMsg.includes("up to date")) {
        console.error("Update error:", error);
      }
    }
  }, [state.status, restart]);

  // Check for updates on mount (once)
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Delay initial check to let the app load
    const timer = setTimeout(() => {
      checkAndDownload();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkAndDownload]);

  return {
    ...state,
    checkForUpdates: checkAndDownload,
    restart,
  };
}
