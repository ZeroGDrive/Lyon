import { useCallback, useEffect, useState } from "react";
import AlertCircle from "lucide-react/dist/esm/icons/circle-alert";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Terminal from "lucide-react/dist/esm/icons/terminal";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkGhCliStatus, type GhCliStatus } from "@/services/github";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onOpenChange, onComplete }: OnboardingDialogProps) {
  const [status, setStatus] = useState<GhCliStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const result = await checkGhCliStatus();
    setStatus(result);
    setIsChecking(false);

    if (result.installed && result.authenticated) {
      onComplete();
      onOpenChange(false);
    }
  }, [onComplete, onOpenChange]);

  useEffect(() => {
    if (open) {
      checkStatus();
    }
  }, [open, checkStatus]);

  const openLink = async (url: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            Welcome to Lyon
          </DialogTitle>
          <DialogDescription>
            Lyon needs the GitHub CLI (gh) to be installed and authenticated to work with your
            repositories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status indicators */}
          <div className="space-y-3">
            <StatusItem
              label="GitHub CLI installed"
              status={status?.installed ? "success" : "error"}
              isLoading={isChecking}
            />
            <StatusItem
              label="GitHub CLI authenticated"
              status={status?.authenticated ? "success" : status?.installed ? "error" : "pending"}
              isLoading={isChecking}
              username={status?.username}
            />
          </div>

          {/* Installation instructions */}
          {status && !status.installed && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
              <h4 className="mb-2 font-medium text-yellow-500">Install GitHub CLI</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                Install the GitHub CLI using one of these methods:
              </p>
              <div className="space-y-2 font-mono text-xs">
                <div className="rounded bg-background/50 p-2">
                  <span className="text-muted-foreground"># macOS (Homebrew)</span>
                  <br />
                  brew install gh
                </div>
                <div className="rounded bg-background/50 p-2">
                  <span className="text-muted-foreground"># Windows (winget)</span>
                  <br />
                  winget install GitHub.cli
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-yellow-500"
                onClick={() => openLink("https://cli.github.com/")}
              >
                View all installation options
                <ExternalLink className="ml-1 size-3" />
              </Button>
            </div>
          )}

          {/* Authentication instructions */}
          {status && status.installed && !status.authenticated && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <h4 className="mb-2 font-medium text-blue-500">Authenticate with GitHub</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                Run this command in your terminal to authenticate:
              </p>
              <div className="rounded bg-background/50 p-2 font-mono text-xs">gh auth login</div>
              <p className="mt-3 text-xs text-muted-foreground">
                Follow the prompts to authenticate with your GitHub account. Make sure to grant
                access to your repositories.
              </p>
            </div>
          )}

          {/* Success state */}
          {status?.installed && status?.authenticated && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <h4 className="mb-1 font-medium text-green-500">You're all set!</h4>
              <p className="text-sm text-muted-foreground">
                {status.username ? (
                  <>
                    Authenticated as{" "}
                    <span className="font-medium text-foreground">{status.username}</span>
                  </>
                ) : (
                  "GitHub CLI is installed and authenticated."
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={checkStatus} disabled={isChecking}>
            {isChecking ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Check Again
          </Button>
          {status?.installed && status?.authenticated && (
            <Button
              onClick={() => {
                onComplete();
                onOpenChange(false);
              }}
            >
              Get Started
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StatusItemProps {
  label: string;
  status: "success" | "error" | "pending";
  isLoading?: boolean;
  username?: string;
}

function StatusItem({ label, status, isLoading, username }: StatusItemProps) {
  return (
    <div className="flex items-center gap-3">
      {isLoading ? (
        <Spinner className="text-muted-foreground" />
      ) : status === "success" ? (
        <CheckCircle2 className="size-5 text-green-500" />
      ) : status === "error" ? (
        <AlertCircle className="size-5 text-red-500" />
      ) : (
        <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
      )}
      <span className="text-sm">
        {label}
        {username && status === "success" && (
          <span className="ml-1 text-muted-foreground">({username})</span>
        )}
      </span>
    </div>
  );
}
