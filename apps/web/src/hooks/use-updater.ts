import { useCallback, useEffect, useState } from "react";

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        setUpdateAvailable({
          version: update.version,
          date: update.date,
          body: update.body ?? undefined,
        });
      } else {
        setUpdateAvailable(null);
      }
    } catch {
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!updateAvailable) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();

      if (update?.available) {
        let totalBytes = 0;
        let downloadedBytes = 0;

        await update.downloadAndInstall((event) => {
          if (event.event === "Started" && event.data.contentLength) {
            totalBytes = event.data.contentLength;
          } else if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          }
        });

        await relaunch();
      }
    } catch {
    } finally {
      setIsDownloading(false);
    }
  }, [updateAvailable]);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    updateAvailable,
    isChecking,
    isDownloading,
    downloadProgress,
    checkForUpdates,
    downloadAndInstall,
  };
}
