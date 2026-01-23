# Lyon

Lyon is an AI-powered pull request review app built with React + TanStack Router and packaged as a Tauri desktop app. It connects to GitHub through the GitHub CLI, lets you browse PRs, review diffs, generate AI feedback, and post comments directly back to GitHub.

## Features

- **PR dashboard**: Browse PRs across multiple repositories, with filters and quick refresh.
- **Rich PR view**: Details, timeline, and merge/close actions.
- **Diff viewer**: Split/unified views, file sidebar, and inline comment threads.
- **AI reviews**: Run Claude or Codex reviews, get structured summaries and file/line comments.
- **Inline posting**: Post AI suggestions as review comments (handles pending reviews).
- **Pending review controls**: Submit or discard draft reviews with full visibility in-app.
- **Desktop + web**: Tauri desktop builds alongside the Vite web app.
- **Modern stack**: TypeScript, Tailwind v4, shadcn/ui, Turborepo, Bun.

## Requirements

- **Bun** (package manager / runtime)
- **GitHub CLI** (`gh`) authenticated (`gh auth login`)
- **Claude Code CLI** and/or **Codex CLI** if you want AI reviews

## Getting Started

Install dependencies:

```bash
bun install
```

Run the web app:

```bash
bun run dev:web
```

Or run all apps:

```bash
bun run dev
```

Open http://localhost:3001

### Tauri Desktop

From `apps/web/`:

```bash
bun run desktop:dev
```

## Key Scripts

- `bun run dev` — start all apps
- `bun run dev:web` — start the web app only
- `bun run build` — build all apps
- `bun run check-types` — type checking
- `bun run check` — lint + format (oxlint + oxfmt)

## How AI Reviews Work

1. Select a PR and open the AI Review panel.
2. Choose provider, model, and focus area (security/performance/etc.).
3. The app invokes the provider CLI to analyze the PR diff.
4. Results are parsed into a structured summary and inline comments.
5. You can post comments directly to GitHub, including pending reviews.

## Repository Structure

```
lyon/
├── apps/web/          # Vite + React web app with TanStack Router
├── packages/env/      # Environment variables
├── packages/config/   # Shared TypeScript config
```

## Notes

- The app uses GitHub CLI for all GitHub operations.
- Draft review comments are surfaced in the UI and can be submitted or discarded.
- If you are reviewing your own PR, approval actions are disabled (per GitHub rules).

---

If you want to customize prompts, add repos, or configure focus areas, use the in-app AI panel and sidebar controls.
