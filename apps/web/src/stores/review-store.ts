import type { AIProvider, AIReviewConfig, AIReviewResult, ReviewFocusArea } from "@/types";
import { DEFAULT_MODELS, DEFAULT_SYSTEM_PROMPTS } from "@/types";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReviewState {
  reviews: AIReviewResult[];
  activeReviewByProvider: Record<AIProvider, AIReviewResult | null>;
  modelByProvider: Record<AIProvider, string>;
  config: AIReviewConfig;
  customPrompts: Record<string, string>;

  addReview: (review: AIReviewResult) => void;
  updateReview: (id: string, updates: Partial<AIReviewResult>) => void;
  setActiveReviewForProvider: (provider: AIProvider, review: AIReviewResult | null) => void;
  setConfig: (config: Partial<AIReviewConfig>) => void;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  setSystemPrompt: (prompt: string) => void;
  saveCustomPrompt: (name: string, prompt: string) => void;
  deleteCustomPrompt: (name: string) => void;
  getReviewsForPR: (prNumber: number, repo: string, provider?: AIProvider) => AIReviewResult[];
  getActiveReviewForProvider: (provider: AIProvider) => AIReviewResult | null;
  clearReviews: () => void;
  clearReviewsForProvider: (provider: AIProvider) => void;
}

const DEFAULT_CONFIG: AIReviewConfig = {
  provider: "claude",
  model: DEFAULT_MODELS.claude,
  systemPrompt: DEFAULT_SYSTEM_PROMPTS.default ?? "",
  temperature: 0.7,
  maxTokens: 4096,
};

const DEFAULT_ACTIVE_REVIEWS: Record<AIProvider, AIReviewResult | null> = {
  claude: null,
  codex: null,
};

const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  claude: DEFAULT_MODELS.claude,
  codex: DEFAULT_MODELS.codex,
};

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: [],
      activeReviewByProvider: { ...DEFAULT_ACTIVE_REVIEWS },
      modelByProvider: { ...DEFAULT_MODEL_BY_PROVIDER },
      config: DEFAULT_CONFIG,
      customPrompts: {},

      addReview: (review) =>
        set((state) => ({
          reviews: [review, ...state.reviews],
          activeReviewByProvider: {
            ...state.activeReviewByProvider,
            [review.provider]: review,
          },
        })),

      updateReview: (id, updates) =>
        set((state) => {
          const updatedReviews = state.reviews.map((r) => (r.id === id ? { ...r, ...updates } : r));
          const updatedReview = updatedReviews.find((r) => r.id === id);
          const newActiveByProvider = { ...state.activeReviewByProvider };

          if (updatedReview) {
            const provider = updatedReview.provider;
            if (state.activeReviewByProvider[provider]?.id === id) {
              newActiveByProvider[provider] = updatedReview;
            }
          }

          return {
            reviews: updatedReviews,
            activeReviewByProvider: newActiveByProvider,
          };
        }),

      setActiveReviewForProvider: (provider, review) =>
        set((state) => ({
          activeReviewByProvider: {
            ...state.activeReviewByProvider,
            [provider]: review,
          },
        })),

      setConfig: (configUpdates) =>
        set((state) => ({
          config: { ...state.config, ...configUpdates },
        })),

      setProvider: (provider) =>
        set((state) => ({
          config: {
            ...state.config,
            provider,
            model: state.modelByProvider[provider],
          },
        })),

      setModel: (model) =>
        set((state) => ({
          config: { ...state.config, model },
          modelByProvider: {
            ...state.modelByProvider,
            [state.config.provider]: model,
          },
        })),

      setSystemPrompt: (prompt) =>
        set((state) => ({
          config: { ...state.config, systemPrompt: prompt },
        })),

      saveCustomPrompt: (name, prompt) =>
        set((state) => ({
          customPrompts: { ...state.customPrompts, [name]: prompt },
        })),

      deleteCustomPrompt: (name) =>
        set((state) => {
          const { [name]: _, ...rest } = state.customPrompts;
          return { customPrompts: rest };
        }),

      getReviewsForPR: (prNumber, repo, provider) => {
        const reviews = get().reviews.filter(
          (r) => r.prNumber === prNumber && r.repository === repo,
        );
        if (provider) {
          return reviews.filter((r) => r.provider === provider);
        }
        return reviews;
      },

      getActiveReviewForProvider: (provider) => {
        return get().activeReviewByProvider[provider];
      },

      clearReviews: () =>
        set({
          reviews: [],
          activeReviewByProvider: { ...DEFAULT_ACTIVE_REVIEWS },
        }),

      clearReviewsForProvider: (provider) =>
        set((state) => ({
          reviews: state.reviews.filter((r) => r.provider !== provider),
          activeReviewByProvider: {
            ...state.activeReviewByProvider,
            [provider]: null,
          },
        })),
    }),
    {
      name: "review-store",
      partialize: (state) => ({
        config: state.config,
        modelByProvider: state.modelByProvider,
        customPrompts: state.customPrompts,
      }),
    },
  ),
);

export function useFocusAreas(): ReviewFocusArea[] {
  return [
    "all",
    "security",
    "performance",
    "best-practices",
    "code-style",
    "documentation",
    "testing",
    "architecture",
  ];
}
