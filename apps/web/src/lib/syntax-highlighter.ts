import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

// LRU Cache for syntax highlighting results
const CACHE_MAX_SIZE = 50;

interface CacheEntry {
  tokens: HighlightedToken[][];
  lastAccess: number;
}

const highlightCache = new Map<string, CacheEntry>();

function getCacheKey(filePath: string, contentHash: string): string {
  return `${filePath}:${contentHash}`;
}

function simpleHash(content: string): string {
  // Fast hash for cache key - FNV-1a inspired
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}

function evictLRU(): void {
  if (highlightCache.size < CACHE_MAX_SIZE) return;

  let oldest: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of highlightCache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldest = key;
    }
  }

  if (oldest) {
    highlightCache.delete(oldest);
  }
}

const LANGUAGE_MAP: Record<string, BundledLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  mdx: "mdx",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  dockerfile: "dockerfile",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  vue: "vue",
  svelte: "svelte",
};

function getLanguageFromPath(filePath: string): BundledLanguage {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const fileName = filePath.split("/").pop()?.toLowerCase() ?? "";

  if (fileName === "dockerfile") return "dockerfile";
  if (fileName.endsWith(".d.ts")) return "typescript";

  return LANGUAGE_MAP[ext] ?? "javascript";
}

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [
        "typescript",
        "tsx",
        "javascript",
        "jsx",
        "python",
        "rust",
        "go",
        "java",
        "json",
        "yaml",
        "html",
        "css",
        "bash",
        "markdown",
        "sql",
      ],
    });
  }
  return highlighterPromise;
}

export interface HighlightedToken {
  content: string;
  color?: string;
}

export async function highlightLine(code: string, filePath: string): Promise<HighlightedToken[]> {
  try {
    const highlighter = await getHighlighter();
    const lang = getLanguageFromPath(filePath);

    const tokens = highlighter.codeToTokensBase(code, {
      lang,
      theme: "github-dark",
    });

    if (tokens.length === 0 || !tokens[0]) {
      return [{ content: code }];
    }

    return tokens[0].map((token) => ({
      content: token.content,
      color: token.color,
    }));
  } catch {
    return [{ content: code }];
  }
}

export async function highlightLines(
  lines: string[],
  filePath: string,
): Promise<HighlightedToken[][]> {
  try {
    const highlighter = await getHighlighter();
    const lang = getLanguageFromPath(filePath);
    const code = lines.join("\n");

    const tokens = highlighter.codeToTokensBase(code, {
      lang,
      theme: "github-dark",
    });

    return tokens.map((lineTokens) =>
      lineTokens.map((token) => ({
        content: token.content,
        color: token.color,
      })),
    );
  } catch {
    return lines.map((line) => [{ content: line }]);
  }
}

/**
 * Cached version of highlightLines with LRU eviction.
 * Use this for repeated highlighting of the same file content.
 */
export async function highlightLinesWithCache(
  lines: string[],
  filePath: string,
): Promise<HighlightedToken[][]> {
  const content = lines.join("\n");
  const contentHash = simpleHash(content);
  const cacheKey = getCacheKey(filePath, contentHash);

  const cached = highlightCache.get(cacheKey);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached.tokens;
  }

  const tokens = await highlightLines(lines, filePath);

  evictLRU();
  highlightCache.set(cacheKey, {
    tokens,
    lastAccess: Date.now(),
  });

  return tokens;
}

export function clearHighlightCache(): void {
  highlightCache.clear();
}

export { getLanguageFromPath };
