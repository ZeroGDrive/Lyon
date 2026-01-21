# AGENTS.md - Coding Agent Guidelines

## Project Overview

Lyon is a TypeScript monorepo built with Turborepo and Bun. It uses React 19, TanStack Router, TailwindCSS v4, and shadcn/ui components.

### Structure

```
lyon/
├── apps/web/          # Vite + React web app with TanStack Router
├── packages/env/      # Environment variables (@t3-oss/env-core + Zod)
├── packages/config/   # Shared TypeScript configuration
```

---

## Build/Lint/Test Commands

### Root Commands (run from project root)

```bash
bun install              # Install dependencies
bun run dev              # Start all apps in development mode
bun run build            # Build all applications
bun run check-types      # TypeScript type checking across all apps
bun run check            # Run oxlint + oxfmt (linting & formatting)
bun run dev:web          # Start only the web application
```

### Web App Commands (from apps/web/)

```bash
bun run dev              # Start Vite dev server (port 3001)
bun run build            # Production build
bun run check-types      # Type check web app only
bun run desktop:dev      # Start Tauri desktop app in dev mode
bun run desktop:build    # Build Tauri desktop app
```

### Linting & Formatting

```bash
bun run check            # Run both oxlint and oxfmt --write
oxlint                   # Lint only
oxfmt --write            # Format only
```

### No Test Framework Currently Configured

This project does not have a test runner set up yet.

---

## Code Style Guidelines

### TypeScript Configuration

Strict mode is enabled with additional safety flags:

- `verbatimModuleSyntax: true` - Requires explicit `type` keyword for type imports
- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- `noUnusedLocals: true` - No unused variables
- `noUnusedParameters: true` - No unused function parameters
- Target: ESNext with Bundler module resolution

### Import Order & Style

1. External packages first (React, libraries)
2. Internal packages (`@lyon/*`)
3. Local imports using path alias `@/`
4. Relative imports for same-directory files
5. CSS imports last

```typescript
// Correct import order
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { env } from "@lyon/env/web";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { localHelper } from "./helpers";

import "../index.css";
```

### Type Imports

Always use explicit `type` keyword for type-only imports (required by `verbatimModuleSyntax`):

```typescript
// Correct
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Wrong - will error
import { VariantProps, cva } from "class-variance-authority";
```

### Naming Conventions

| Element          | Convention           | Example                                 |
| ---------------- | -------------------- | --------------------------------------- |
| Files            | kebab-case           | `mode-toggle.tsx`, `theme-provider.tsx` |
| Components       | PascalCase           | `ModeToggle`, `ThemeProvider`           |
| Functions        | camelCase            | `createRouter`, `setTheme`              |
| Route components | Named functions      | `HomeComponent`, `RootComponent`        |
| Constants        | SCREAMING_SNAKE_CASE | `TITLE_TEXT`, `API_URL`                 |
| Types/Interfaces | PascalCase           | `RouterAppContext`, `ButtonProps`       |

### Component Patterns

**Function components only** (no class components):

```typescript
// Default export for route/page components
export default function Header() {
  return <div>...</div>;
}

// Named export for UI components
function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export { Button, buttonVariants };
```

**Props pattern** - Destructure with rest spread:

```typescript
function Component({
  className,
  variant = "default",
  ...props
}: ComponentProps) {
  return <div className={cn(baseStyles, className)} {...props} />;
}
```

### Tailwind & Styling

- Use `cn()` utility from `@/lib/utils` for merging classes
- Use class-variance-authority (cva) for component variants
- TailwindCSS v4 with `@tailwindcss/vite` plugin
- Components use `data-slot` attribute for identification

```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-classes", conditional && "conditional-classes", className)} />
```

### TanStack Router

File-based routing in `apps/web/src/routes/`:

```typescript
// Route file pattern
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/path")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>...</div>;
}
```

### Error Handling

- Explicit error checks with meaningful messages
- No silent failures or empty catch blocks
- Validate environment variables with Zod via `@t3-oss/env-core`

```typescript
const rootElement = document.getElementById("app");
if (!rootElement) {
  throw new Error("Root element not found");
}
```

### Path Aliases

- `@/*` maps to `./src/*` in web app
- Use workspace protocol for internal packages: `@lyon/env`, `@lyon/config`

---

## Project-Specific Notes

### UI Components

- Located in `apps/web/src/components/ui/`
- Based on shadcn/ui patterns using Base UI primitives
- Use cva for variant definitions

### Environment Variables

- Define in `packages/env/src/web.ts` using `@t3-oss/env-core`
- Validate with Zod schemas
- Import as `import { env } from "@lyon/env/web"`

### Module System

- ESModules only (`"type": "module"` in package.json)
- Use `node:` prefix for Node.js built-ins: `import path from "node:path"`

---

## Common Pitfalls to Avoid

1. **Don't use type-only imports without `type` keyword** - Will fail due to `verbatimModuleSyntax`
2. **Don't ignore undefined from indexed access** - Handle `T | undefined` due to `noUncheckedIndexedAccess`
3. **Don't use relative imports when `@/` alias works** - Keep imports consistent
4. **Don't mix default/named exports incorrectly** - Routes use default, UI uses named
5. **Don't forget `cn()` when accepting className prop** - Always merge with base classes
