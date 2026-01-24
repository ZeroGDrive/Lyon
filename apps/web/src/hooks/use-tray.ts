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
