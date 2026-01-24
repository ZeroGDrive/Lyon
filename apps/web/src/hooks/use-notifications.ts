import { useCallback, useEffect, useState } from "react";

import { useSettingsStore } from "@/stores";

type NotificationType = "newPr" | "reviewComplete" | "newCommits" | "aiReviewDone";

export function useNotifications() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationTypes = useSettingsStore((s) => s.notificationTypes);

  useEffect(() => {
    async function checkPermission() {
      try {
        const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
        const granted = await isPermissionGranted();
        setPermissionGranted(granted);
      } catch {}
    }
    checkPermission();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const { requestPermission } = await import("@tauri-apps/plugin-notification");
      const permission = await requestPermission();
      setPermissionGranted(permission === "granted");
      return permission === "granted";
    } catch {
      return false;
    }
  }, []);

  const notify = useCallback(
    async (type: NotificationType, title: string, body: string) => {
      if (!permissionGranted) return;

      const typeEnabled = notificationTypes[type];
      if (!typeEnabled) return;

      try {
        const { sendNotification } = await import("@tauri-apps/plugin-notification");
        await sendNotification({ title, body });
      } catch {}
    },
    [permissionGranted, notificationTypes],
  );

  return {
    permissionGranted,
    requestPermission,
    notify,
  };
}
