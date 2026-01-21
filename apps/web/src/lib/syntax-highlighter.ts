import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

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

export { getLanguageFromPath };
