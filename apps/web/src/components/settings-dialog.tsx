import type { AIProvider } from "@/types";

import Check from "lucide-react/dist/esm/icons/check";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";

import { useReviewStore, useSettingsStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watchedRepos: string[];
}

const providerOptions: Array<{ id: AIProvider; label: string; description: string }> = [
  { id: "claude", label: "Claude", description: "Fast, sharp review summaries" },
  { id: "codex", label: "Codex", description: "Deep code reasoning focus" },
];

const providerItems = providerOptions.map((option) => ({
  value: option.id,
  label: option.label,
}));

function SettingsDialog({ open, onOpenChange, watchedRepos }: SettingsDialogProps) {
  const {
    defaultProvider,
    defaultRepos,
    reducedTransparency,
    soundEnabled,
    setDefaultProvider,
    addDefaultRepo,
    removeDefaultRepo,
    setReducedTransparency,
    setSoundEnabled,
  } = useSettingsStore();
  const { setProvider } = useReviewStore();

  const handleProviderChange = (provider: AIProvider) => {
    setDefaultProvider(provider);
    setProvider(provider);
  };

  const toggleDefaultRepo = (repo: string, checked: boolean) => {
    if (checked) {
      addDefaultRepo(repo);
    } else {
      removeDefaultRepo(repo);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Personalize your review workflow and UI preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI defaults</h3>
              <p className="text-xs text-muted-foreground">
                Pick the provider Lyon should use by default.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={defaultProvider}
                onValueChange={(item) => {
                  const val = item as { value: string; label: string } | null;
                  if (val) handleProviderChange(val.value as AIProvider);
                }}
                items={providerItems}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerItems.map((item) => (
                    <SelectItem key={item.value} value={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {providerOptions.find((option) => option.id === defaultProvider)?.description}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Default watchlist</h3>
              <p className="text-xs text-muted-foreground">
                Choose which repos should always load on startup.
              </p>
            </div>
            {watchedRepos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-glass-border-subtle p-4 text-xs text-muted-foreground">
                Add repositories to your watchlist to set defaults.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {watchedRepos.map((repo) => {
                  const checked = defaultRepos.includes(repo);
                  return (
                    <label
                      key={repo}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-glass-border-subtle px-3 py-2 text-xs",
                        checked && "bg-primary/5",
                      )}
                    >
                      <span className="truncate font-mono">{repo}</span>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleDefaultRepo(repo, Boolean(value))}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Interface</h3>
              <p className="text-xs text-muted-foreground">Tweak visual density and feedback.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-glass-border-subtle px-3 py-2 text-xs">
                <Label htmlFor="reduced-transparency" className="flex-1">
                  Reduce transparency
                </Label>
                <Checkbox
                  id="reduced-transparency"
                  checked={reducedTransparency}
                  onCheckedChange={(value) => setReducedTransparency(Boolean(value))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-glass-border-subtle px-3 py-2 text-xs">
                <Label htmlFor="sound-enabled" className="flex-1">
                  Sound effects
                </Label>
                <Checkbox
                  id="sound-enabled"
                  checked={soundEnabled}
                  onCheckedChange={(value) => setSoundEnabled(Boolean(value))}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              <Check className="mr-2 size-4" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { SettingsDialog };
