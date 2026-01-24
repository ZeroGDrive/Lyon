import type { PullRequest } from "@/types";

import { useEffect } from "react";

export function useTrayBadge(count: number) {
  useEffect(() => {
    async function updateBadge() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_tray_badge", { count: count > 0 ? count : null });
      } catch {}
    }
    updateBadge();
  }, [count]);
}

export function useTrayMenu(prs: PullRequest[]) {
  useEffect(() => {
    async function updateMenu() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const trayPrs = prs.slice(0, 10).map((pr) => ({
          number: pr.number,
          title: pr.title,
          repo: pr.repository.fullName,
        }));
        await invoke("update_tray_menu", { prs: trayPrs });
      } catch {}
    }
    updateMenu();
  }, [prs]);
}
