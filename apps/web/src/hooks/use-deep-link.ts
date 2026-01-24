import { useEffect } from "react";

interface DeepLinkHandlers {
  onOpenPR?: (owner: string, repo: string, prNumber: number) => void;
  onAddRepo?: (owner: string, repo: string) => void;
  onRefresh?: () => void;
}

export function useDeepLink(handlers: DeepLinkHandlers) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");

        const startUrls = await getCurrent();
        if (startUrls && startUrls.length > 0) {
          for (const url of startUrls) {
            handleUrl(url, handlers);
          }
        }

        unlisten = await onOpenUrl((urls) => {
          for (const url of urls) {
            handleUrl(url, handlers);
          }
        });
      } catch {}
    }

    setup();

    return () => {
      unlisten?.();
    };
  }, [handlers]);
}

function handleUrl(urlString: string, handlers: DeepLinkHandlers) {
  try {
    const url = new URL(urlString);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (url.protocol !== "lyon:") return;

    if (pathParts[0] === "pr" && pathParts.length >= 4) {
      const owner = pathParts[1];
      const repo = pathParts[2];
      const prNumber = parseInt(pathParts[3] ?? "", 10);
      if (owner && repo && !isNaN(prNumber)) {
        handlers.onOpenPR?.(owner, repo, prNumber);
      }
    } else if (pathParts[0] === "repo" && pathParts.length >= 3) {
      const owner = pathParts[1];
      const repo = pathParts[2];
      if (owner && repo) {
        handlers.onAddRepo?.(owner, repo);
      }
    } else if (pathParts[0] === "refresh") {
      handlers.onRefresh?.();
    }
  } catch {}
}
