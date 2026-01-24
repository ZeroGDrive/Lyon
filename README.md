<p align="center">
  <img src="apps/web/src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Lyon">
</p>

<h1 align="center">Lyon</h1>

<p align="center">
  <strong>AI-powered pull request reviews on your desktop</strong>
</p>

<p align="center">
  <a href="https://github.com/ZeroGDrive/Lyon/releases/latest">
    <img src="https://img.shields.io/github/v/release/ZeroGDrive/Lyon?style=flat-square" alt="Latest Release">
  </a>
  <a href="https://github.com/ZeroGDrive/Lyon/releases">
    <img src="https://img.shields.io/github/downloads/ZeroGDrive/Lyon/total?style=flat-square" alt="Downloads">
  </a>
  <a href="https://github.com/ZeroGDrive/Lyon/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ZeroGDrive/Lyon?style=flat-square" alt="License">
  </a>
</p>

---

Lyon is a native desktop app that brings AI-powered code reviews to your pull request workflow. Connect to GitHub, browse PRs across your repositories, and get intelligent feedback from Claude or Codex — all from a beautiful, fast interface.

> **Use your existing AI subscription** — Lyon works with your Claude Code or Codex CLI. No additional API costs or subscriptions required. If you already have access to Claude or Codex, you're ready to go.

## Features

- **PR Dashboard** — Browse pull requests across multiple repositories with smart filtering and instant refresh
- **Rich Diff Viewer** — Split or unified views, file tree navigation, and inline comment threads
- **AI Reviews** — Run Claude or Codex to analyze code changes and get structured feedback
- **Inline Posting** — Post AI suggestions directly to GitHub as review comments
- **Review Management** — Submit, approve, or request changes with full pending review support
- **System Tray** — Quick access to your top PRs right from the menu bar
- **Cross-Platform** — Native builds for macOS, Windows, and Linux

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/ZeroGDrive/Lyon/releases) page:

- **macOS**: `Lyon_x.x.x_aarch64.dmg` (Apple Silicon) or `Lyon_x.x.x_x64.dmg` (Intel)
- **Windows**: `Lyon_x.x.x_x64-setup.exe`
- **Linux**: `Lyon_x.x.x_amd64.deb` or `Lyon_x.x.x_amd64.AppImage`

### Requirements

- **GitHub CLI** (`gh`) — [Install](https://cli.github.com/) and authenticate with `gh auth login`
- **AI Provider** (optional) — Use your existing subscription, no extra costs:
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — Uses your Claude Pro/Team subscription
  - [Codex CLI](https://github.com/openai/codex) — Uses your OpenAI/ChatGPT subscription

## Quick Start

1. Download and install Lyon for your platform
2. Ensure GitHub CLI is installed and authenticated: `gh auth login`
3. Launch Lyon and add your repositories
4. Select a PR and start reviewing!

## AI Reviews

Lyon integrates with AI coding assistants to provide intelligent code review:

1. Open a pull request in Lyon
2. Select your AI provider (Claude or Codex) and model
3. Choose a review focus: General, Security, Performance, or Custom
4. Click "Start Review" — the AI analyzes the diff and provides:
   - Overall assessment and score
   - File-by-file comments with severity levels
   - Actionable suggestions with code fixes
5. Post comments directly to GitHub with one click

## Development

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Rust](https://rustup.rs/) (for Tauri)
- GitHub CLI (`gh`) authenticated

### Setup

```bash
# Clone the repository
git clone https://github.com/ZeroGDrive/Lyon.git
cd lyon

# Install dependencies
bun install

# Run the desktop app in development
bun run desktop:dev

# Or run just the web app
bun run dev:web
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development |
| `bun run dev:web` | Start web app only |
| `bun run desktop:dev` | Start Tauri desktop app |
| `bun run build` | Build all apps |
| `bun run check-types` | TypeScript type checking |
| `bun run check` | Lint and format (oxlint + oxfmt) |

### Project Structure

```
lyon/
├── apps/
│   └── web/              # React + Vite web app
│       └── src-tauri/    # Tauri desktop wrapper
├── packages/
│   ├── config/           # Shared TypeScript config
│   └── env/              # Environment variables
```

## Tech Stack

- **Frontend**: React 19, TypeScript, TanStack Router, Tailwind CSS v4
- **Desktop**: Tauri 2.0 (Rust)
- **UI**: shadcn/ui components
- **Build**: Turborepo, Bun, Vite

## License

MIT

---

<p align="center">
  Made with ❤️ for developers who care about code quality
</p>
