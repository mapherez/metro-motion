# 0) Preface & How to Use

> **What this is:** A practical playbook for humans and AI agents working in this monorepo. It encodes architecture, boundaries, and non-negotiables so changes stay consistent, accessible, and easy to maintain.

## 0.1 Audience & Scope
- **Audience:** VS Code AI assistants (e.g., Copilot/Cursor/Codex-style agents) and developers.
- **Scope:** Frontend UI, theming, i18n, state/data flow, backend routes, testing, security, CI/CD, and release hygiene.
- **Non-goals:** Full product docs or company policy. Legal/privacy policy lives elsewhere; this doc points to engineering practices.

## 0.2 Quick Start (Humans)
- Read **§1 Purpose & Operating Rules** (mindset) and **§2 Repository Map** (where things live).
- Doing UI work? Focus on **§4 UI**, **§5 Theming**, **§6 i18n**, **§9 A11y**, **§8 Performance**, **§10 Testing**.
- Touching data/state? See **§7 State/Data**, **§11 Logging/Telemetry**, **§12 Security**.
- Shipping? Check **§13 Git/Release** and **§14 Playbooks**.  
- If you change architecture or public APIs, log it in **§16 Decision Log**.

## 0.3 Quick Start (Agents)
- **Always** read §1–§2 and respect **§2.8 Import Boundaries**.
- Use the **playbooks** in §14 for scaffolding/refactors; don’t invent ad-hoc steps.
- Enforce **strict TypeScript**, **no `any`**, **no deep imports**, and **no hardcoded strings/colors** (use i18n + tokens).
- Run the validation scripts before proposing diffs: `typecheck`, `lint`, `test`, `build`, `validate:config`.

### Agent System Primer (paste into your tool’s “instructions” field)
~~~txt
You are contributing to a TypeScript monorepo. Before any change, read AGENTS.md §§1–2 and obey §2.8 import boundaries. 
Optimize for clarity, modularity, i18n, theming, accessibility, and performance budgets. 
Do not hardcode user-facing strings or colors; use locales and theme tokens. 
Use the playbooks in §14 for scaffolding/refactors and update §16 Decision Log when you alter architecture or public APIs. 
After edits, run: pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build && pnpm -w validate:config.
~~~

## 0.4 File Placement & Conventions
- This file is **`/AGENTS.md`** at the repo root.
- References like **§7.4** point to sections inside this document.
- JSON settings and locales live in **`/config`** and **`/locales`**, with per-app overrides (see **§2.4** and **§6.2**).

## 0.5 Update Policy
- **Small rule tweaks:** edit this doc and append a one-liner in **`docs/decisions.md`** (see **§16.2**).
- **Big decisions (state model, theming model, public API):** add an ADR (**§16.3**).
- Treat this doc as **source of truth**; code and CI should enforce its rules (lint, schemas, budgets).

## 0.6 Guardrails (Hard “No”s)
- No deep imports into other packages’ internals (`dist/*` or `src/*` of another package).
- No disabling lint/type checks to “make it pass”.
- No hardcoded user-facing text or colors (must go through locales/tokens).
- No PII in logs/telemetry; respect consent (see **§11.7**).
- No app code inside packages; **packages never import from `apps/*`**.

## 0.7 VS Code Tips
- Open Preview: **Markdown → “Open Preview to the Side”** (`Ctrl+K V` / `⌘K V`) to live-view this file while editing.
- Recommended extensions: **ESLint**, **Prettier**, **EditorConfig**, **Markdown All in One**, **markdownlint**, **i18n Ally** (optional).

## 0.8 When in Doubt
- Prefer **existing patterns** over new ones; consistency > novelty.
- If you must deviate, leave a **decision log** entry (see §16) and add lint/tests to back the change.
- Keep PRs small; use **Changesets** for versioning (see **§13.5**).

---

# 1. Purpose & Operating Rules

## 🎯 Purpose

This project is a **monorepo** containing multiple packages and apps. The goal of this document is to guide AI agents (and humans) to:

- Produce **consistent, maintainable, and modular code**.
- Follow **best practices for TypeScript, UI components, and monorepo boundaries**.
- Respect **internationalization (i18n), theming, accessibility, and performance budgets**.
- Enable future contributors (human or AI) to understand **why decisions were made**.

## ✅ Operating Rules

- **Clarity over cleverness** → Code must be easy to read and maintain. Avoid “smart” one-liners.
- **Consistency wins** → Follow existing patterns before inventing new ones. If change is needed, update the decision log.
- **Modularity first** → Build small, reusable, and testable pieces.
- **Types are contracts** → Always use strict TypeScript; avoid `any`. Types must be explicit and descriptive.
- **Accessibility is non-negotiable** → Support keyboard navigation, ARIA roles, and proper color contrast.
- **Performance-aware** → Minimize re-renders, avoid heavy deps, and respect bundle size targets.
- **i18n from day one** → No hardcoded user-facing strings. Always use the locale system.
- **Theming-ready** → Components must support multiple themes (light, dark, others) without hacks.
- **Configurable by design** → Use JSON files for **settings** (links, feature flags, visibility rules, active theme) and **locales** (translations). These must be structured so users can easily locate and edit them.
- **Fail safe, not loud** → Handle errors gracefully and provide fallbacks instead of crashing.
- **Automate enforcement** → Prefer lint rules, tests, or scripts over manual policing.

## 🧠 Agent Mindset (Checklist)

Before making changes, always ask:

1. Am I following existing patterns instead of inventing new ones?
2. Is my code modular, typed, and easy to test?
3. Does this respect i18n, theming, accessibility, and customization rules?
4. Is performance and maintainability considered?
5. If I deviate, did I update or justify it in the decision log?

# 2) Repository Map (Monorepo)

> **Goal:** Make it dead-simple for humans and agents to find things, respect boundaries, and scaffold new features without spaghetti.

## 2.1 Root Layout

```
/
├─ apps/
│ ├─ frontend/ # Web client (Vite + React)
│ └─ backend/ # API server (Fastify)
├─ packages/
│ ├─ shared-types/ # Types-only package (builds to dist/)
│ ├─ shared-utils/ # Pure TS utilities (no DOM/Node side effects)
│ └─ station-data/ # Data package (types + data loaders)
├─ config/ # Centralized settings (JSON) + schemas
│ ├─ schemas/ # JSON Schemas for validation (settings, themes, app-config)
│ ├─ settings/ # Global settings (env-agnostic, overridable)
│ │ ├─ defaults.json
│ │ ├─ features.json # Feature flags (per app can override)
│ │ └─ routes.json # Button links, external URLs, etc.
│ └─ themes/ # Theme tokens in JSON (light, dark, etc.)
│ ├─ light.json
│ └─ dark.json
├─ locales/ # i18n strings (ICU-safe, namespaced)
│ ├─ en/
│ │ ├─ common.json
│ │ ├─ home.json
│ │ └─ errors.json
│ └─ pt/
│ ├─ common.json
│ ├─ home.json
│ └─ errors.json
├─ scripts/ # Repo-wide scripts (node/tsx)
├─ .github/
│ └─ workflows/ # CI (lint, typecheck, build, test, release)
├─ .husky/ # Git hooks (pre-push: typecheck+lint+tests)
├─ pnpm-workspace.yaml
├─ turbo.json
├─ package.json # Root scripts: dev, build, lint, typecheck
├─ .editorconfig
├─ .gitignore
└─ README.md
```

### Root principles

- **Public APIs only:** Apps may import from packages’ **public entrypoints** (ESM exports). No deep imports.
- **One concern per package:** Keep data, utils, and UI separate to prevent circular deps.
- **Everything typed & built:** All packages output `dist/` with `.d.ts` — even if purely types/utils.

---

## 2.2 Apps

### `apps/frontend/`

```
apps/frontend/
├─ src/
│ ├─ app/ # App shell, providers (i18n, theme)
│ ├─ components/ # Reusable, stateless components
│ ├─ features/ # Feature folders (route + state + UI)
│ ├─ pages/ # Route-level pages
│ ├─ hooks/ # Reusable React hooks
│ ├─ styles/ # Global styles, Tailwind base
│ └─ lib/ # Frontend-only helpers (no Node deps)
├─ public/ # Static assets
├─ app.config.json # App-level settings overrides
├─ locales/ # App-specific string overrides (optional)
└─ theme.config.json # App-level theme selection/overrides
```

- **Config load order (frontend):**  
  `config/settings/*.json` → `apps/frontend/app.config.json` (override)  
  `config/themes/*.json` → `apps/frontend/theme.config.json` (select/override)  
  `locales/<lang>/*.json` → `apps/frontend/locales/<lang>/*.json` (override keys)

### `apps/backend/`

```
apps/backend/
├─ src/
│ ├─ server.ts # Fastify boot
│ ├─ routes/ # Route modules
│ ├─ services/ # Business logic
│ ├─ lib/ # Backend-only helpers (fetch, redis)
│ └─ config.ts # Reads settings via config loader
├─ app.config.json # Backend overrides (limits, caching, URLs)
└─ .env(.example) # Env secrets; never commit actual secrets
```

- **Config load order (backend):**  
  `config/settings/*.json` → `apps/backend/app.config.json` → env vars

---

## 2.3 Packages

### `packages/shared-types`

- **Purpose:** Cross-repo types and contracts.
- **Rules:** No runtime side-effects. Build to `dist/` with types.

### `packages/shared-utils`

- **Purpose:** Pure functions used across apps.
- **Rules:** No DOM, no Node-only APIs (keep it isomorphic). If a util needs Node, split it to `shared-utils-node`.

### `packages/station-data`

- **Purpose:** Data models + typed loaders/parsers.
- **Rules:** No UI imports. Can depend on `shared-types`.

> **Import rule summary:**  
> Apps → packages (public exports only).  
> Packages → other packages (types/utils only).  
> Packages must **not** import from apps.

---

## 2.4 Settings & Locales (Customizable by Design)

### Settings JSON (global-first, app-overridable)

- **Location:** `config/settings/*.json` for globals; `apps/*/app.config.json` for per-app overrides.
- **Examples:**

```json
// config/settings/defaults.json
{
  "appName": "Metro Live",
  "defaultLocale": "en",
  "featureFlags": { "showLiveMap": true, "betaPanels": false },
  "theme": "light",
  "routes": { "help": "/help", "feedback": "https://..." },
  "ui": { "hideElements": ["betaBadge"] }
}

// apps/frontend/app.config.json (override)
{
  "featureFlags": { "betaPanels": true },
  "theme": "dark",
  "routes": { "feedback": "/feedback" }
}
```

- **Validation:** Provide JSON Schema in config/schemas/settings.schema.json.
  > Agents must validate app configs at build/start and fail with a helpful error.

### Locale JSON (ICU-friendly, namespaced)

- **Location:** `locales/<lang>/<namespace>.json` (global); per-app overrides in `apps/*/locales/<lang>/`.

- **Examples:**

```json
// locales/en/common.json
{
  "app.title": "Metro Live",
  "nav.home": "Home",
  "nav.about": "About",
  "errors.network": "Network error. Please try again."
}
```

```json
// apps/frontend/locales/en/common.json (override just one key)
{ "nav.about": "About this project" }
```

- **Rules:**

> - No string concatenation for user-facing text.

> - Use ICU/plural rules where needed.

> - Dates/numbers via Intl APIs.

---

## 2.5 Themes & Tokens

- **Location:** `config/themes/*.json`
- **Shape:**

```json
{
  "name": "light",
  "colors": {
    "bg": "#ffffff",
    "fg": "#0b0b0b",
    "primary": "#2563eb",
    "muted": "#9ca3af"
  },
  "radius": { "md": 10 },
  "shadow": { "sm": "0 1px 2px rgba(0,0,0,0.05)" }
}
```

- **Selection:** Each app sets `"theme": "light"` (or overrides) in `apps/*/theme.config.json`.
- **Frontend apply:** Convert tokens → CSS custom properties at app boot; set a class or `data-theme` on `<html>`.
- **SSR/FOUC:** Persist theme (cookie/localStorage) and inline initial CSS vars to avoid flashes.

---

## 2.6 Infra & Automation

### `.github/workflows/`

- **ci.yml:** `pnpm i`, `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w build`, `pnpm -w test`
- **release.yml (optional):** conventional commits / changesets → version + changelog
- **preview.yml (optional):** Deploy previews per PR (Vercel/Netlify/Fly/etc.)

### `.husky/`

- **pre-push:** `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- **commit-msg (optional):** enforce Conventional Commits

### `scripts/`

- `validate-config.ts` — JSON Schema validation for settings + themes
- `extract-i18n-keys.ts` — static scan to ensure keys exist (warn on missing/unused)
- `generate-types-from-schema.ts` — optional: Zod/JSON Schema → TS types

---

## 2.7 Root Files (Scaffolding Checklist)

- **`.gitignore`** → ignore builds, env files, caches, OS junk  
  Example:

  ```gitignore
  # builds
  dist/
  .turbo/
  node_modules/

  # env & secrets
  .env
  .env.*
  !.env.example

  # coverage & misc
  coverage/
  .DS_Store
  ```

- **`.editorconfig`** → spaces, LF, final newline
- **`pnpm-workspace.yaml`** → includes `apps/*`, `packages/*`, `infra/*`
- **`turbo.json`** → tasks for `build`, `typecheck`, `lint`, `test`
- **`package.json` (root) scripts:**
  ```json
  {
    "scripts": {
      "dev": "turbo run dev --parallel",
      "build": "turbo run build",
      "typecheck": "turbo run typecheck",
      "lint": "turbo run lint",
      "test": "turbo run test",
      "validate:config": "tsx scripts/validate-config.ts"
    }
  }
  ```

---

## 2.8 Import Boundaries (Enforced)

Use ESLint rules to prevent deep imports and app→package violations.

- Apps **must import from package public entrypoints** only (no `dist/*` deep paths).
- Packages **must not import from `apps/*`**.
- `shared-utils` must be **isomorphic** (no DOM/Node globals). If needed, split a `shared-utils-node`.

**ESLint example (`eslint.config.js` or `.eslintrc`):**

```js
module.exports = {
  rules: {
    // No deep internal modules from packages
    "import/no-internal-modules": [
      "error",
      {
        forbid: [
          "@metro/shared-utils/**",
          "@metro/shared-types/**",
          "@metro/station-data/**",
        ],
      },
    ],
    // Disallow app imports inside packages
    "no-restricted-imports": [
      "error",
      {
        patterns: ["apps/*"],
      },
    ],
  },
  settings: {
    "import/resolver": { typescript: true },
  },
};
```

---

## 2.9 How to Add a New App (Agent Recipe)

1. Scaffold `apps/<name>` with `package.json`, `tsconfig.json`, `app.config.json`, `theme.config.json`.
2. Add base folders: `src/app/`, `src/pages/`, `src/features/`, `src/components/`, `src/hooks/`, `src/styles/`, `src/lib/`.
3. Register the app in `pnpm-workspace.yaml`.
4. (Optional) Add `apps/<name>/locales/<lang>/*.json` to override strings.
5. Ensure CI passes and `pnpm validate:config` succeeds.

---

## 2.10 Decision Log (Living)

Create `docs/decisions.md` with one-liners (date, what, why, link to PR).

```md
- 2025-09-18: Centralized config/locales layout for multi-app overrides. Reason: clarity + scalability. PR: #123
- 2025-09-18: Enforced package import boundaries. Reason: prevent cycles/deep imports. PR: #124
```

---

### Notes specific to this repo

- ✅ Already on **pnpm + turbo** — great base.
- 🧩 Added `config/`, `locales/`, `.github/`, `.husky/`, and `scripts/` to make customization + automation first-class.
- 🧪 Add `typecheck` tasks per package/app and wire into CI + pre-push.
- 📦 Put i18n helpers and a tiny config loader (global + app overrides + JSON Schema validation) in `shared-utils`.

# 3) Coding Standards (TypeScript, Lint & Format)

> **Goal:** Make code predictable, safe, and easy to extend across multiple apps/packages.

## 3.1 Language & Targets
- **TypeScript** everywhere (strict mode).
- **ESM only**; no CommonJS.
- **Targets**
  - Frontend: modern browsers per `browserslist`.
  - Backend: Node 20+.
- **Never** use `any`. Prefer `unknown` + narrowing.

**`tsconfig.base.json` (root)**
~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "importsNotUsedAsValues": "error",
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@shared-types/*": ["packages/shared-types/src/*"],
      "@shared-utils/*": ["packages/shared-utils/src/*"],
      "@station-data/*": ["packages/station-data/src/*"],
      "@app/*": ["apps/*/src/*"]
    }
  }
}
~~~

## 3.2 File & Naming Conventions
- **Files**
  - React components: `PascalCase.tsx` (one component per file).
  - Hooks: `useSomething.ts`.
  - Utilities/types: `kebab-case.ts`.
  - Tests: `*.test.ts` / `*.test.tsx` next to file or in `__tests__/`.
- **Exports**
  - Prefer **named exports**; avoid default exports.
  - Barrel files (`index.ts`) allowed only at package/public boundaries.
- **Variables**
  - Booleans: `is/has/can/should`.
  - Constants: `SCREAMING_SNAKE_CASE` (exported), `camelCase` (local).
  - Types: `PascalCase` (`User`, `UserId`).
  - Functions: `verbNoun` (`buildUrl`, `fetchStations`).
- **Meaningful names > abbreviations.** Avoid cryptic short names.

## 3.3 Modules & Public APIs
- Apps may import **only public entrypoints** of packages (`@shared-utils`, not `@shared-utils/internal/x`).
- Packages **must not** import from `apps/*`.
- Each package exposes a **single public surface** from `src/index.ts`.

~~~ts
// packages/shared-utils/src/index.ts
export * from "./date/formatDate";
export * from "./i18n/translate";
~~~

## 3.4 Imports & Order
- **Order**: Node built-ins → external deps → internal aliases (`@shared-*`) → relative → styles.
- **No deep imports** into other packages’ internals.
- Prefer **absolute aliases** over long relative chains.

~~~ts
// good
import fs from "node:fs";
import React from "react";
import { translate } from "@shared-utils/i18n/translate";
import { Station } from "@shared-types/station";
import { useSomething } from "@/hooks/useSomething"; // alias to @app/* via tsconfig
import "./component.css";
~~~

## 3.5 Type Safety Patterns
- Prefer `type` aliases; use `interface` only for public contracts that benefit from declaration merging.
- Avoid `enum`; use `as const` objects + union types.

~~~ts
export const Theme = { Light: "light", Dark: "dark" } as const;
export type Theme = (typeof Theme)[keyof typeof Theme];
~~~

- Narrow `unknown` and `catch`:

~~~ts
try {
  // ...
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  log.error({ msg });
}
~~~

- Exhaustive switches:

~~~ts
switch (theme) {
  case "light": /* ... */ break;
  case "dark": /* ... */ break;
  default: {
    const _exhaustive: never = theme;
    throw new Error(`Unknown theme: ${_exhaustive}`);
  }
}
~~~

## 3.6 React Component Standards (Frontend)
- **Function components** only. Do **not** use `React.FC`.
- Props are **explicitly typed**. `children` is **opt-in**.
- Use **composition** and **controlled props**; avoid hidden internal singletons.
- Forward refs when exposing focus/imperative handles.
- Accessibility: label + role + keyboard first; no click-only controls.

~~~tsx
type ButtonProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ onPress, variant = "primary", className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      data-variant={variant}
      className={cn("inline-flex items-center", className)}
      {...rest}
    />
  );
}
~~~

### Styling (Tailwind)
- Use Tailwind utility classes. For conditionals, use a small helper:

~~~ts
// packages/shared-utils/src/cn.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...args: unknown[]) => twMerge(clsx(args as any));
~~~

- Avoid inline `style` where CSS variables or classes suffice.

## 3.7 Side Effects, State & Data
- **Local first**: Prefer local component state; lift state only when shared.
- **Derived state** must be computed, not duplicated.
- **Side effects** live in hooks (`useEffect`, custom hooks). Keep components pure.
- **Data fetching**: keep in hooks/services; components consume hooks. (Details in §7 “State Management & Data Flow”.)

## 3.8 Error Handling & User Feedback
- **Do not swallow errors.** Either return a typed `Result` or throw and show a user-safe message.
- Use a small `Result` helper for non-exception flows (optional):

~~~ts
type Ok<T> = { ok: true; value: T };
type Err<E = string> = { ok: false; error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
~~~

- Frontend: show friendly messages; log details to console/telemetry.
- Backend: attach safe context (no PII) and consistent error codes.

## 3.9 Async Rules
- No **floating promises**; handle or explicitly `void` with a comment.
- Prefer `Promise.allSettled` for independent tasks.
- Timeouts/retries/backoff via utility; avoid ad-hoc loops.

~~~ts
// no-floating-promises rule enforced
void analytics.track("event"); // intentionally fire-and-forget (document why)
~~~

## 3.10 Linting (ESLint) & Formatting (Prettier)
- **ESLint**: `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-promise`, `eslint-plugin-unused-imports`, `eslint-plugin-jsx-a11y` (frontend), plus boundaries rules (see §2.8).
- **Prettier**: single source of formatting truth. No conflicting ESLint formatting rules.

**`.eslintrc.js` (root)**
~~~js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "promise", "unused-imports"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:promise/recommended"
  ],
  settings: { "import/resolver": { typescript: true } },
  rules: {
    // TS strictness
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",

    // Imports & boundaries
    "import/no-internal-modules": ["error", { forbid: ["@shared-*/**", "@station-data/**"] }],
    "no-restricted-imports": ["error", { patterns: ["apps/*"] }],
    "import/order": ["warn", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
      "newlines-between": "always"
    }],

    // General safety
    "eqeqeq": ["error", "smart"],
    "curly": ["error", "all"]
  },
  overrides: [
    {
      files: ["**/*.tsx"],
      plugins: ["jsx-a11y"],
      extends: ["plugin:jsx-a11y/recommended"],
      rules: {}
    },
    {
      files: ["apps/backend/**/*.ts"],
      env: { node: true }
    }
  ]
};
~~~

**`.prettierrc` (root)**
~~~json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "arrowParens": "always",
  "proseWrap": "preserve"
}
~~~

> **Automation:** CI (`.github/workflows/ci.yml`) must run: `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`, `pnpm -w build`.

## 3.11 Package Layout Conventions
Each package:
~~~txt
packages/<name>/
├─ src/
│  └─ index.ts          # public API
├─ tsconfig.json
├─ package.json
└─ README.md
~~~
- Build to `dist/` with type declarations.
- No side-effects on import.
- Keep Node-only utils (`fs`, `path`) out of isomorphic packages.

## 3.12 CSS & Theming Hooks
- Expose a **theme loader** that maps JSON tokens to CSS variables at boot.
- Use `data-theme` on `<html>` and a `useTheme()` hook to switch.
- Respect `prefers-color-scheme` and user override (persisted).

## 3.13 Documentation & Examples
- Each shared util or complex component should have a **JSDoc** header and a minimal usage snippet.
- Public functions must document errors/throws and return types.

---

### Agent Quick Checklist (for this section)
1. Is TS strict and free of `any`?
2. Are imports from packages using **public** entrypoints only?
3. Are exports **named**, and files named per convention?
4. Does the React code follow the component standards and a11y rules?
5. Do ESLint/Prettier pass locally before committing?

> For commit style, PR checks, and releases, see **§13 Git Hygiene & Release Workflow**.

# 4) UI Architecture & Components

> **Goal:** Make UI components modular, reusable, testable, themeable, and i18n-friendly across multiple apps.

## 4.1 Component Taxonomy

- **Primitives**: Low-level building blocks (Button, Input, Checkbox, Modal, Tooltip).
- **Compound**: Components composed of coordinated parts via context (e.g., Tabs, Accordion, Select).
- **Feature Components**: App/feature-specific UIs that wire data/state + primitives (e.g., StationSearchPanel).
- **Layouts**: Page shells (AppLayout, SettingsLayout).
- **Page/Route**: Top-level routed components; thin; delegate to features.

**Rule:** Reusable UI (primitives/compound) lives in a shared package (`packages/ui`) when it becomes cross-app. Otherwise, it starts inside the app (`apps/frontend/src/components`) and can be promoted later.

---

## 4.2 Folder Anatomy (per component)

Each component lives in its own folder. Co-locate styles, tests, stories, and a README with API notes.

~~~txt
<component-root>/
├─ Button/
│  ├─ Button.tsx
│  ├─ Button.types.ts
│  ├─ Button.test.tsx
│  ├─ Button.stories.mdx          # optional if Storybook is used
│  ├─ README.md                    # short usage + a11y notes
│  └─ index.ts                     # re-exports
~~~

`index.ts` only re-exports the public API.

~~~ts
// Button/index.ts
export * from "./Button";
export type * from "./Button.types";
~~~

---

## 4.3 Props & Patterns

- **Props must be explicit**; avoid `any`. Document required vs optional.
- **Pass-through DOM props**: extend the intrinsic element props and safely spread `...rest`.
- **`className`** accepted for composition; merged via `cn()`.
- **Controlled inputs** preferred (value/onChange). If uncontrolled, expose `defaultValue` and a `ref`.
- **Avoid boolean prop explosion**; use **variant props** or **discriminated unions**.
- **No data fetching inside primitives**; they are purely presentational/behavioral.

Example (Button variants):

~~~ts
type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  as?: "button" | "a";
  href?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  "data-analytics-id"?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;
~~~

---

## 4.4 Composition > Inheritance

Prefer **children**, **slots**, and **render props**. Use the **compound component** pattern when subparts must coordinate.

Example (Tabs, simplified):

~~~tsx
// Tabs.tsx
const TabsContext = React.createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const ctx = React.useMemo(() => ({ value, setValue: onChange }), [value, onChange]);
  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

export function TabList({ children }: { children: React.ReactNode }) {
  return <div role="tablist">{children}</div>;
}

export function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)!;
  const selected = ctx.value === id;
  return (
    <button
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={() => ctx.setValue(id)}
    >
      {children}
    </button>
  );
}

export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)!;
  if (ctx.value !== id) return null;
  return <div role="tabpanel">{children}</div>;
}

// index.ts
export const TabsRoot = Object.assign(Tabs, { List: TabList, Tab, Panel: TabPanel });
~~~

---

## 4.5 Styling & Tokens (Tailwind + CSS Vars)

- Use Tailwind utilities for layout and spacing.  
- **Theme tokens** are exposed as CSS variables (e.g., `--color-bg`, `--color-fg`) on `<html data-theme="light|dark">`.
- In Tailwind, reference CSS vars via arbitrary values (e.g., `text-[var(--color-fg)]`).

Button example:

~~~tsx
import { cn } from "@shared-utils/cn";

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "text-[var(--color-fg)] bg-[var(--color-primary)]",
        "data-[variant=ghost]:bg-transparent data-[variant=ghost]:text-[var(--color-primary)]",
        "data-[size=sm]:h-8 data-[size=sm]:px-3 data-[size=sm]:text-sm",
        "data-[size=md]:h-10 data-[size=md]:px-4",
        "data-[size=lg]:h-12 data-[size=lg]:px-5 data-[size=lg]:text-lg",
        className
      )}
      {...rest}
    />
  );
}
~~~

**Note:** Prefer **data-attributes** for variants/sizes instead of adding more class logic. Tokens are defined in `config/themes/*.json` and injected at app boot.

---

## 4.6 Theming

- Set theme with `<html data-theme="light|dark|custom">`.  
- On boot, **inject CSS variables** from the selected theme JSON.  
- Provide a `useTheme()` hook with **get/set** and **persistence** (localStorage or cookie).  
- Respect `prefers-color-scheme` as default on first load.  
- Avoid hardcoded colors inside components; rely on tokens.

---

## 4.7 Accessibility (a11y) Rules

- Every interactive component must be **keyboard operable** and expose correct **ARIA roles/states**.
- Click targets must be **buttons/anchors** (not bare `div`), or add role + key handlers.
- Manage **focus** visibly. Return focus from dialogs/menus to the trigger.
- Provide **`aria-label`/`aria-describedby`** when no visible label exists.
- Respect **reduced motion** via `prefers-reduced-motion`.

**Lint:** enable `eslint-plugin-jsx-a11y` and fix violations before merging.

---

## 4.8 i18n in Components

- **No hardcoded user-facing strings** in reusable primitives. Accept `children`, `aria-label`, or formatted strings from callers.
- Feature/page components may use the translation hook (`useT()`), but **never** build sentences via string concatenation; use ICU.
- All placeholders/alt text/tooltips are translatable.

---

## 4.9 State Boundaries

- Primitives/compound components: **stateless**, behavior-only (may manage internal UI state like open/closed).
- Feature components: own data fetching and cross-component state via hooks/services.
- Move shared state to hooks (e.g., `useStations()`), leaving components as consumers.
- See §7 for data flow & caching guidelines.

---

## 4.10 Performance Patterns

- Prefer **memoization** for stable props (`React.memo` when beneficial).
- Heavy/rare components → **lazy load** with `React.lazy` + suspense fallback.
- Long lists → **virtualize** (e.g., `react-virtual`) in feature components.
- Avoid re-creating inline objects/functions; use `useMemo`/`useCallback` sensibly.

---

## 4.11 Testing Rules (per component)

- Use **@testing-library/react** for DOM tests; test behavior, not implementation.
- Required tests for primitives:
  - Renders with default/variant props.
  - Keyboard and ARIA correctness.
  - Calls handlers (`onPress`, `onChange`) as expected.
- Snapshot only for **stable** markup (icons/svgs ok).
- Keep tests co-located (`Button.test.tsx`).

---

## 4.12 Storybook (optional but recommended)

If using Storybook:

- Co-locate `*.stories.mdx` next to the component.  
- Add **Controls**, **A11y**, and **Viewport** addons.  
- Include one **“Recipes”** story demonstrating composition with other primitives.  
- Ensure stories reflect **real tokens** and **themes** (switchable via toolbar).

---

## 4.13 Analytics & Telemetry (non-PII)

- Components may accept a `data-analytics-id` prop.
- Feature components trigger analytics in handlers (debounced, no PII).
- Do not log raw input values or personally identifiable data.

---

## 4.14 Promotion Rule (App → Package)

- When a component is used by **2+ apps** or clearly generic, promote it to `packages/ui`.
- Keep the public API stable and documented; add a migration note if breaking.

---

## 4.15 Agent Recipes

### A) Add a New Primitive Component
1. Create folder: `src/components/<Name>/`.
2. Add `Name.tsx`, `Name.types.ts`, `index.ts`, `Name.test.tsx`, `README.md` (and `Name.stories.mdx` if Storybook).
3. Use tokens (CSS vars) and Tailwind utilities; accept `className`.
4. Add a11y attributes and keyboard support.
5. Export from a barrel (`src/components/index.ts`) if the app/package maintains one.
6. Write basic tests (render, interaction, a11y).

### B) Add a Compound Component
1. Define a React context and a root component `<Xxx>` exposing state via props.
2. Add subcomponents (e.g., `<Xxx.Trigger>`, `<Xxx.Content>`).
3. Wire ARIA roles and focus management.
4. Test keyboard flows and focus return.
5. Document usage with a short “Getting Started” snippet.

### C) Promote to `packages/ui`
1. Move folder to `packages/ui/src/Name/`.
2. Update import paths and build config.
3. Export from `packages/ui/src/index.ts`.
4. Run typecheck, tests, and build; update references in apps.
5. Add a short entry to `docs/decisions.md`.

---

## 4.16 Quick Checklist (for this section)

- Does the component avoid hardcoded colors/text and rely on tokens + caller-provided strings?
- Are a11y roles/labels and keyboard interactions correct?
- Is the component stateless (except internal UI state) and reusable?
- Are variant/size handled via data-attributes or discriminated props (no boolean explosion)?
- Do tests cover render, interaction, and a11y basics?

# 5) Design System — Tokens, Theming, and Dark Mode

> **Goal:** Centralize visual decisions as **tokens** so apps/components are themeable, accessible, and consistent across the monorepo.

## 5.1 Token Philosophy

- **Semantic > raw values.** Components consume **semantic tokens** (e.g., `--color-surface`, `--color-text-muted`) instead of hardcoded hex values.
- **One source of truth.** Theme JSON lives in `config/themes/*.json` and is validated against a schema.
- **Composable themes.** Themes can **extend** a base (inherit + override).
- **Runtime via CSS vars.** Tokens become CSS variables on `<html data-theme="...">`.
- **A11y first.** Color pairs must meet WCAG contrast targets (AA minimum).

---

## 5.2 Theme JSON Shape

- Location: `config/themes/*.json`
- Each theme file includes **foundations** (raw palette/scale) and **semantic** mappings.

~~~json
{
  "name": "light",
  "extends": "base",
  "foundations": {
    "palette": {
      "neutral": ["#0b0b0b", "#1a1a1a", "#2a2a2a", "#e5e7eb", "#f5f7fa", "#ffffff"],
      "primary": ["#0b3aa8", "#2563eb", "#93c5fd"],
      "success": ["#065f46", "#10b981", "#d1fae5"],
      "warning": ["#854d0e", "#f59e0b", "#fef3c7"],
      "danger":  ["#7f1d1d", "#ef4444", "#fee2e2"]
    },
    "radius": { "sm": 6, "md": 10, "lg": 16, "xl": 24 },
    "shadow": {
      "sm": "0 1px 2px rgba(0,0,0,.06)",
      "md": "0 4px 10px rgba(0,0,0,.10)"
    },
    "typography": {
      "fontFamily": "Inter, system-ui, sans-serif",
      "scale": { "xs": 12, "sm": 14, "md": 16, "lg": 18, "xl": 20, "2xl": 24 }
    }
  },
  "semantic": {
    "color": {
      "bg": "{palette.neutral[5]}",
      "surface": "{palette.neutral[4]}",
      "overlay": "rgba(0,0,0,.5)",
      "text": "{palette.neutral[0]}",
      "text-muted": "{palette.neutral[2]}",
      "border": "rgba(0,0,0,.12)",
      "primary": "{palette.primary[1]}",
      "on-primary": "#ffffff",
      "success": "{palette.success[1]}",
      "warning": "{palette.warning[1]}",
      "danger":  "{palette.danger[1]}"
    },
    "radius": "{radius}",
    "shadow": "{shadow}",
    "zIndex": { "dropdown": 1000, "modal": 1100, "toast": 1200 }
  }
}
~~~

> **Note:** The `{path.to.token}` syntax is resolved by the config loader at build/start (see `scripts/validate-config.ts`/token resolver).

---

## 5.3 JSON Schema (Validation)

- Location: `config/schemas/theme.schema.json`
- Validate on CI and app boot. Fail with a **clear error** if tokens are missing/invalid.

~~~json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Theme",
  "type": "object",
  "required": ["name", "semantic"],
  "properties": {
    "name": { "type": "string" },
    "extends": { "type": "string" },
    "foundations": { "type": "object" },
    "semantic": {
      "type": "object",
      "properties": {
        "color": { "type": "object" },
        "radius": { "type": ["object", "string"] },
        "shadow": { "type": ["object", "string"] },
        "zIndex": { "type": "object" }
      },
      "required": ["color"]
    }
  }
}
~~~

---

## 5.4 CSS Variable Emission

- At app boot, selected theme JSON is **flattened** to CSS vars:

~~~css
/* emitted on <html data-theme="light"> */
:root[data-theme="light"]{
  --color-bg: #ffffff;
  --color-surface: #f5f7fa;
  --color-overlay: rgba(0,0,0,.5);
  --color-text: #0b0b0b;
  --color-text-muted: #2a2a2a;
  --color-border: rgba(0,0,0,.12);
  --color-primary: #2563eb;
  --color-on-primary: #ffffff;

  --radius-sm: 6px;
  --radius-md: 10px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --zIndex-modal: 1100;
}
~~~

- Components use **CSS vars via Tailwind arbitrary values**:  
  `bg-[var(--color-surface)] text-[var(--color-text)]`

---

## 5.5 Dark Mode & Additional Themes

- Add `config/themes/dark.json` extending `base` and swapping semantic colors.
- Respect `prefers-color-scheme` as a default when no user choice exists.
- Support **custom/brand themes** (e.g., `ocean`, `forest`) by adding new theme files.

**`apps/<name>/theme.config.json`**
~~~json
{ "theme": "dark", "overrides": { "semantic.color.primary": "#22c55e" } }
~~~

---

## 5.6 Theme Selection & Persistence

- Initial theme resolution order:
  1) App override (`apps/*/theme.config.json`)  
  2) User choice (localStorage/cookie)  
  3) System preference (`prefers-color-scheme`)  
  4) Fallback to `"light"`

- Expose a small API:

~~~ts
export type ThemeName = "light" | "dark" | string;

export function getTheme(): ThemeName { /* read from DOM/cookie */ }
export function setTheme(next: ThemeName) {
  document.documentElement.setAttribute("data-theme", next);
  // Also update CSS vars bundle for 'next', then persist in storage.
}
~~~

---

## 5.7 SSR & FOUC Prevention

- Inline minimal `<style>` with CSS vars for the **initial theme** on the server (or a pre-hydration script) to avoid a flash.
- Example approach:
  - Read cookie `theme=dark` on SSR, resolve theme JSON, and inline its vars in `<head>`.
  - Include a tiny inline script that runs before render to set `data-theme` and root vars if no SSR.

---

## 5.8 Token Categories (Recommended Set)

- **Color:** `bg`, `surface`, `overlay`, `border`, `text`, `text-muted`, `primary`, `on-primary`, `success`, `warning`, `danger`, `info`.
- **Spacing:** `space-1..space-8` (4, 8, 12, 16, 20, 24, 32, 40).
- **Radius:** `sm`, `md`, `lg`, `xl`.
- **Shadow:** `sm`, `md`, `lg`.
- **Typography:** `font-family`, `font-size-scale` (`xs..2xl`), `line-height`.
- **Motion:** `duration-quick/normal/slow`, `easing-standard/decelerate/accelerate`.
- **Z-Index:** `dropdown`, `modal`, `toast`, `overlay`.

> Keep names **stable**; deprecate instead of renaming to avoid churn.

---

## 5.9 Tailwind Bridge

- Prefer **arbitrary values** with CSS vars (most flexible):

~~~tsx
<div className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]" />
~~~

- Optional: define a **small CSS base** that maps Tailwind semantic classes to vars:

~~~css
/* apps/frontend/src/styles/theme.css */
:root, :root[data-theme="light"]{
  --twc-bg: var(--color-bg);
  --twc-text: var(--color-text);
  --twc-primary: var(--color-primary);
}

.bg-surface { background-color: var(--twc-bg); }
.text-body { color: var(--twc-text); }
.text-primary { color: var(--twc-primary); }
~~~

Then you can use: `className="bg-surface text-body"`

---

## 5.10 Contrast & A11y Gate

- Provide a script to **verify contrast** between key pairs (`text` on `bg/surface`, `on-primary` on `primary`, alerts, etc.).
- Fail CI if contrast < AA (4.5:1 for normal text, 3:1 for large).

~~~ts
// scripts/check-contrast.ts (pseudo)
import { ratio } from "./lib/contrast";
function assertContrast(fg: string, bg: string, min: number) {
  if (ratio(fg, bg) < min) throw new Error(`Contrast ${fg} vs ${bg} below ${min}:1`);
}
assertContrast(theme.semantic.color.text, theme.semantic.color.bg, 4.5);
assertContrast(theme.semantic.color["on-primary"], theme.semantic.color.primary, 4.5);
~~~

---

## 5.11 Adding a New Theme (Agent Recipe)

1. Copy `config/themes/light.json` → `config/themes/<name>.json`.
2. Set `"name"` and optionally `"extends": "light"` or `"dark"`.
3. Adjust **semantic** colors first (bg/surface/text/primary/border).
4. Run `pnpm validate:config` and the contrast check script.
5. Add to `apps/*/theme.config.json` or expose a theme switcher.

---

## 5.12 Component-Level Theming

- Components should **not** import theme JSON directly. They read CSS vars produced by the app at boot.
- Variant/size are expressed via **data-attributes** (`data-variant`, `data-size`) and styled using vars:

~~~css
/* Button.css (if using CSS modules or global) */
button[data-variant="primary"]{
  color: var(--color-on-primary);
  background: var(--color-primary);
}
button[data-variant="ghost"]{
  color: var(--color-primary);
  background: transparent;
}
~~~

---

## 5.13 Multi-Brand Support

- For multiple brands, create **brand base themes** (e.g., `brand-foo-light.json`, `brand-foo-dark.json`).
- Apps select brand via `apps/<name>/theme.config.json`.
- Keep **semantic token names identical** across brands to minimize component branching.

---

## 5.14 Quick Checklist (for this section)

- Are components free of hardcoded colors/spacing and using CSS vars?
- Does the selected theme emit CSS vars at boot and persist user choice?
- Do light/dark variants meet contrast requirements (AA or better)?
- Are theme files validated by schema and checked in CI?
- If multi-brand, are semantic token names consistent across brands?

# 6) i18n & Locale Strategy

> **Goal:** Make all user-facing text translatable, consistent, and easy to maintain across apps. No hardcoded strings in UI.

## 6.1 Principles

- **Global-first, app-override**: Global strings live in `/locales/<lang>/<ns>.json`; apps can override per key in `apps/<name>/locales/<lang>/<ns>.json`.
- **ICU messages**: Use ICU syntax for plural, select, and rich formatting.
- **Stable keys**: `UPPER_SNAKE_CASE` only (e.g., `NAV_HOME`, `ERRORS_NETWORK_TIMEOUT`). **No dots.** Namespacing is by **file** (namespace), not by key.
- **No concatenation**: Messages are complete sentences; dynamic bits are placeholders (`{name}`, `{count}`).
- **A11y parity**: Any visible string has an accessible equivalent (labels, `aria-*`, alt text).

---

## 6.2 File Layout

~~~txt
/locales/
  en/
    common.json
    nav.json
    errors.json
  pt/
    common.json
    nav.json
    errors.json

apps/<app>/
  locales/
    en/
      common.json   # (optional) app-specific overrides
    pt/
      common.json   # (optional)

config/schemas/
  locale.schema.json
~~~

**Load order** per app & language:
1) `/locales/<lang>/*.json`
2) `apps/<app>/locales/<lang>/*.json` (shallow-merge override by key)

---

## 6.3 Key Naming

- **Case & charset:** `UPPER_SNAKE_CASE` → `^[A-Z][A-Z0-9_]*$`
- **Namespacing by file:** group keys by JSON file (`common.json`, `nav.json`, `errors.json`…), **not** by `.` in key names.
- **Suggested prefixes (optional):** `NAV_*`, `CTA_*`, `LABEL_*`, `MSG_*`, `ERRORS_*`, `ARIA_*`

Bad: `title2`, `msg_123`, `nav.home`, `errors.network.timeout`  
Good: `HOME_TITLE`, `MSG_WELCOME_USER`, `NAV_HOME`, `ERRORS_NETWORK_TIMEOUT`

---

## 6.4 ICU Message Examples

~~~json
{
  "HOME_TITLE": "Welcome, {name}!",
  "CART_ITEMS": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "UPLOAD_PROGRESS": "{done, number, percent} complete",
  "DATE_SHORT": "{value, date, short}",
  "STATUS": "{state, select, loading {Loading…} success {Done} error {Error}}"
}
~~~

---

## 6.5 JSON Schema (Validation)

- Validate all locale files on CI and at dev start.
- Enforce **flat** objects with **UPPER_SNAKE_CASE** keys.

~~~json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Locale Namespace (Flat, UPPER_SNAKE_CASE keys)",
  "type": "object",
  "additionalProperties": { "type": "string" },
  "propertyNames": { "pattern": "^[A-Z][A-Z0-9_]*$" }
}
~~~

---

## 6.6 Runtime API (React)

Minimal i18n layer: merge selected namespaces into a single **flat map** of key → message. Implement once in `packages/shared-utils`.

~~~ts
// packages/shared-utils/src/i18n/index.ts
import { IntlMessageFormat } from "intl-messageformat";

export type Messages = Record<string, string>;
export type TranslateOptions = Record<string, unknown>;
export type TFn = (key: string, vars?: TranslateOptions) => string;

export function createTranslator(messages: Messages, lang: string): TFn {
  const cache = new Map<string, IntlMessageFormat>();
  return (key, vars) => {
    const msg = messages[key];
    if (!msg) return key; // fallback: show key if missing
    let fmt = cache.get(key);
    if (!fmt) {
      fmt = new IntlMessageFormat(msg, lang);
      cache.set(key, fmt);
    }
    return fmt.format(vars) as string;
  };
}
~~~

Usage:

~~~tsx
// apps/frontend/src/app/providers/i18n.tsx
import { createTranslator } from "@shared-utils/i18n";

const messages = await loadMessages({ lang, namespaces: ["common", "nav", "errors"] });
// messages is a flat { [KEY]: "…" } map
const T = createTranslator(messages, lang);

export const I18nContext = React.createContext<{ t: (k: string, v?: any)=>string; lang: string }>({ t: (k)=>k, lang: "en" });
export function I18nProvider({ children, lang }: { children: React.ReactNode; lang: string }) {
  const value = React.useMemo(() => ({ t: (k: string, v?: any) => T(k, v), lang }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useT = () => React.useContext(I18nContext).t;
~~~

Component:

~~~tsx
const t = useT();
<h1>{t("HOME_TITLE", { name: "Pedro" })}</h1>
<p>{t("CART_ITEMS", { count: 3 })}</p>
~~~

---

## 6.7 Loading, Fallback, Switching

- **Initial language resolution**:
  1) App config (`config/settings/defaults.json` → `defaultLocale`)
  2) User preference (storage/cookie)
  3) Browser (`navigator.language`)
  4) Fallback: `"en"`

- **Fallback chain** for missing keys: `app override → global lang → global 'en'`.

- **Runtime switch**:
  - Swap `lang` in context.
  - Lazy-load namespaces for new language.
  - Re-render without reload.

---

## 6.8 Numbers, Dates, Lists

Use `Intl.*` for formatting (no ad-hoc formatting).

~~~ts
new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(date)
new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(1234.56)
new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(["One","Two","Three"])
~~~

Prefer using ICU placeholders (`{value, date, short}`) so translators can control style.

---

## 6.9 Rich Text & Components

For strings that need inline links or bold text, use token placeholders and map them in code.

~~~json
{
  "LEGAL_NOTICE": "Read our <link>privacy policy</link>."
}
~~~

~~~tsx
// render with a simple tag-mapper
renderRich(t("LEGAL_NOTICE"), {
  link: (children) => <a href="/privacy">{children}</a>
})
~~~

Avoid embedding raw HTML in JSON.

---

## 6.10 RTL & Locale-specific Rules

- Detect RTL languages (e.g., `ar`, `he`) and set `dir="rtl"` on `<html>`.
- Ensure icons/motion that imply direction are mirrored or neutral.
- Avoid culture-bound idioms; keep messages neutral and translatable.

---

## 6.11 A11y & Alt Text

- All images/icons must have `alt` text keys in locales.
- Controls require `aria-label` or visible labels sourced from locales.
- Announce dynamic updates with `aria-live` regions using localized strings.

---

## 6.12 Tooling & CI

Scripts in `/scripts`:

- `extract-i18n-keys.ts`: scan source for `t("...")` and build a **key registry** (generate `UPPER_SNAKE_CASE` keys automatically).
- `lint-i18n.ts`: check for **missing/unused** keys per language + namespace.
- `validate-locales.ts`: JSON Schema validation (enforces flat keys + pattern).
- `pseudo-localize.ts`: optional script to expand and accentuate strings for layout testing.

**ESLint guard (flat keys only):**
- Add a rule to block dotted keys in `t("…")` calls.

~~~js
// eslint.config.mjs (example)
{
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "warn",
      { selector: "CallExpression[callee.name='t'] Literal[value=/\\./]", message: "Locale keys must be UPPER_SNAKE_CASE (no dots)." }
    ]
  }
}
~~~

CI must run: `typecheck`, `lint`, `validate-locales`, and i18n lints.

---

## 6.13 Tests

- Unit-test message formatting (plural/select) with snapshot per language.
- E2E (critical flows) should verify visible text in both primary and fallback language.
- Prevent regressions: if a key is removed/renamed, fail CI unless migration is provided.

---

## 6.14 Adding Content (Agent Recipes)

### A) Add a New Language
1. Duplicate `/locales/en` → `/locales/<lang>`.
2. Translate files; keep **identical keys**.
3. Add `<lang>` to `config/settings/defaults.json` supported list.
4. Run `pnpm validate:config` and `pnpm i18n:lint`.

### B) Add a New Namespace
1. Create `/locales/en/<ns>.json` and `/locales/pt/<ns>.json`.
2. Register the namespace in the app’s i18n loader.
3. **Use `t("KEY_NAME")`** in components (do **not** embed namespace in key).

### C) Add/Change a Key
1. Add to `en` first, then translate in other languages (or mark TODO).
2. If renaming, add a temporary alias mapping to avoid breaking older clients.
3. Update tests and run i18n lint.

---

## 6.15 Do & Don’t

**Do**
- Use ICU placeholders and plural/select
- Keep keys semantic, flat, and `UPPER_SNAKE_CASE`
- Validate and lint locales in CI
- Provide a11y strings for all controls

**Don’t**
- Build sentences with concatenation
- Embed HTML directly in JSON
- Reuse one key for different meanings
- Hardcode dates/numbers/currency
- Use dotted keys (e.g., `nav.home`)

---

## 6.16 Quick Checklist (for this section)

- Are all user-facing strings loaded via `t()` with ICU placeholders?
- Do app overrides merge correctly and fallback to global → `en`?
- Are locales validated and linted in CI with the **UPPER_SNAKE_CASE** rule?
- Does runtime language switch without reload?
- Are a11y/alt strings present and localized?

# 7) State Management & Data Flow

> **Goal:** Keep state minimal, predictable, and colocated. Treat server data differently from UI state. Avoid “god stores.”

## 7.1 Principles

- **Server state ≠ UI state**: Use a data-fetching cache for server data; use small local/global stores for UI-only state.
- **Single source of truth**: Normalize by `id` when it helps; avoid duplicating the same server data in multiple places.
- **Colocation**: State lives where it’s used; lift only when necessary.
- **Derive, don’t duplicate**: Compute derived values from base state.
- **Immutable updates**: Avoid in-place mutations of shared objects.
- **Observable boundaries**: Components subscribe narrowly (avoid re-render storms).

---

## 7.2 Architectural Layers

~~~txt
packages/
  shared-types/          # TS models & API contracts
  shared-utils/          # fetch client, query key helpers, mappers, Result, etc.
  station-data/          # domain-specific loaders/parsers (no React)

apps/frontend/
  src/features/<domain>/
    api/                 # concrete API calls using shared-utils client
    hooks/               # React hooks (queries/mutations)
    components/          # UI consuming hooks
    state/               # (optional) tiny UI store (e.g., Zustand) for this feature

apps/backend/
  src/routes/            # HTTP endpoints
  src/services/          # domain logic (pure)
  src/adapters/          # DB/cache/external API adapters
~~~

**Rules**
- `packages/*` contain **no React**.  
- Hooks live in apps (`features/<domain>/hooks/`) and use **public** helpers from packages.  
- Backend returns data conforming to `shared-types` (validated).

---

## 7.3 Libraries & Choices

- **Server state**: TanStack Query (a.k.a. React Query).  
  - caching, dedupe, retries, background refetch, prefetch.
- **UI-only state**: small stores (e.g., Zustand) or local component state.  
  - theme/locale stay in providers; navigation state in the URL.
- **Validation**: Zod for runtime parsing of API responses/requests.

> If you’re not using these libs yet, the patterns still apply (names are illustrative).

---

## 7.4 Query Conventions (Server State)

- **Key factory** per domain; include all filters in the key.
- **Cache policy**:
  - `staleTime` defaults: list = 15s, detail = 60s.
  - `gcTime` (a.k.a. cacheTime) = 5 min.
  - Revalidate on window focus & reconnect.
- **Pagination**: cursor-based preferred; fall back to page/size.

~~~ts
// packages/shared-utils/src/query-keys.ts
export const qk = {
  station: {
    list: (filters: { lineId?: string }) => ["station", "list", filters] as const,
    detail: (id: string) => ["station", "detail", id] as const
  }
};
~~~

~~~ts
// apps/frontend/src/features/stations/hooks/useStations.ts
import { useQuery } from "@tanstack/react-query";
import { qk } from "@shared-utils/query-keys";
import { fetchStations } from "../api/fetchStations";

export function useStations(filters: { lineId?: string }) {
  return useQuery({
    queryKey: qk.station.list(filters),
    queryFn: () => fetchStations(filters),
    staleTime: 15_000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
  });
}
~~~

**Prefetch & hydrate** (if SSR later): prefetch in loader, dehydrate on server, hydrate on client.

---

## 7.5 Mutation Conventions

- **Optimistic UI** when safe; otherwise invalidate exact keys.
- **Error-first UX**: toast/snackbar + inline hint; rollback on failure.
- **Idempotency**: backend accepts `Idempotency-Key` for non-GET when feasible.

~~~ts
// apps/frontend/src/features/stations/hooks/useUpdateStation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@shared-utils/query-keys";
import { updateStation } from "../api/updateStation";

export function useUpdateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateStation,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.station.detail(input.id) });
      const prev = qc.getQueryData(qk.station.detail(input.id));
      qc.setQueryData(qk.station.detail(input.id), (curr: any) => ({ ...curr, ...input.patch }));
      return { prev };
    },
    onError: (_e, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.station.detail(input.id), ctx.prev);
    },
    onSettled: (_d, _e, input) => {
      qc.invalidateQueries({ queryKey: qk.station.detail(input.id) });
      qc.invalidateQueries({ queryKey: qk.station.list({}) });
    },
    retry: 1
  });
}
~~~

---

## 7.6 Error, Loading & Empty States

- **Centralize** skeletons/spinners for consistency.
- Distinguish:
  - **Loading** (skeleton),
  - **Empty** (helpful next steps),
  - **Error** (retry + contact link).
- **Retry/backoff** via library (no custom loops).
- **401/403**: route to login or show permission message; don’t loop.

---

## 7.7 URL & Navigational State

- Put **filters, sort, pagination, search** into the URL (query params) so it’s shareable.
- Sync a local state object with `URLSearchParams` via a tiny hook.

~~~ts
// apps/frontend/src/lib/useQueryParams.ts
export function useQueryParams<T extends Record<string, string | undefined>>(schema: T) {
  // read from location.search, coerce with schema, write on change (replaceState)
  // return [params, setParams]
}
~~~

---

## 7.8 UI-Only State (Tiny Stores)

- Use a **feature-scoped store** (e.g., Zustand) when state is shared across siblings.
- Avoid a global “app store” unless truly cross-cutting (e.g., auth session).

~~~ts
// apps/frontend/src/features/panels/state/usePanelStore.ts
import { create } from "zustand";
type PanelState = { openId?: string; open: (id: string)=>void; close: ()=>void };
export const usePanelStore = create<PanelState>((set) => ({
  openId: undefined,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: undefined })
}));
~~~

---

## 7.9 Data Validation & Mapping

- Validate **all** API responses with Zod at the edge (api client).  
- Map transport → domain models; keep UI decoupled from backend quirks.

~~~ts
// packages/shared-types/src/station.ts
import { z } from "zod";
export const Station = z.object({
  id: z.string(),
  name: z.string(),
  lineId: z.string(),
  lat: z.number(),
  lon: z.number()
});
export type Station = z.infer<typeof Station>;
~~~

~~~ts
// packages/shared-utils/src/http.ts
import { Station } from "@shared-types/station";
export async function getStation(id: string) {
  const res = await fetch(`/api/stations/${id}`);
  const json = await res.json();
  return Station.parse(json); // throws with clear message if invalid
}
~~~

---

## 7.10 Caching & Persistence

- **React Query cache** holds server data in-memory; don’t mirror it in local stores.
- **Persist** only UI prefs (theme, locale) and non-sensitive flags.  
  - Keys are namespaced: `app:<name>:theme`.  
  - Never store secrets/tokens in localStorage (use httpOnly cookies).
- Consider **IndexedDB** only for large offline caches (explicit requirement).

---

## 7.11 Backend Data Contract (Alignment)

- Return typed JSON matching `shared-types`. Validate in Fastify with Zod or JSON Schema.
- **Pagination**: `GET /items?cursor=...&limit=...` → `{ items: [], nextCursor?: string }`
- **Filters**: explicit query params; whitelist & validate.
- **Caching headers**: `ETag/If-None-Match` for GET; set sensible `Cache-Control` for static lists.
- **Error envelope**:
  - `{"error": {"code":"STATION_NOT_FOUND","message":"..."}}`
  - Include `requestId` (correlation ID) for tracing.
- **Rate limits** & **compression** at the edge.

~~~ts
// apps/backend/src/routes/stations.ts (sketch)
fastify.get("/stations/:id", {
  schema: { /* params + response with shared schema */ }
}, async (req, reply) => {
  const data = await services.stations.getById(req.params.id);
  if (!data) return reply.code(404).send({ error: { code: "STATION_NOT_FOUND", message: "Station not found" } });
  reply.header("ETag", etag(data)).send(data);
});
~~~

---

## 7.12 Concurrency & Dedupe

- Let the query library dedupe parallel requests by **key**.
- For custom fetches, use a **request map** (key → in-flight promise) to share results.
- Guard mutations that can double-submit (disable buttons on submit or use idempotency keys).

---

## 7.13 Offline & Realtime (Optional)

- **Offline**: serve cached queries; show a banner; queue mutations if required.
- **Realtime**: if using websockets/SSE, update the cache via `queryClient.setQueryData()` with minimal patches.

---

## 7.14 Agent Recipes

### A) Add a List Query
1. Create a **key** in `shared-utils/query-keys`.
2. Add a **fetcher** in `features/<domain>/api`.
3. Create a **hook** using `useQuery` with the key and fetcher.
4. Render a component with loading/empty/error states.
5. Write tests: hook (success/error) + component behavior.

### B) Add a Mutation with Optimistic Update
1. Implement `useMutation` with `onMutate` snapshot + optimistic patch.
2. Rollback on `onError`.
3. Invalidate affected keys on `onSettled`.
4. Toast success/error; add a11y live region message.

### C) Add a Small UI Store
1. Create `state/use<Feature>Store.ts` with a tiny state shape.
2. Use in sibling components; avoid leaking into unrelated features.
3. Add tests for state transitions.

---

## 7.15 Quick Checklist (for this section)

- Is server data fetched via a cache (query library) with clear keys & policies?
- Are filters/sort/page in the **URL**, not hidden in random stores?
- Are mutations either optimistic (with rollback) or followed by precise invalidation?
- Are API responses validated with Zod and mapped to domain types?
- Are UI-only states kept **small** and **feature-scoped** (or local)?

# 8) Performance Budgets & Patterns

> **Goal:** Ship fast-by-default UIs/APIs with measurable budgets, CI checks, and clear recipes to fix regressions.

## 8.1 Principles

- **Budget-first:** Define hard limits; reject PRs that exceed them.
- **Measure where it matters:** Track **Core Web Vitals** (LCP, CLS, INP) at p75 in production.
- **Load less, later:** Split code by route/feature; lazy-load non-critical UI.
- **Do work off the main thread:** Web Workers, async APIs, and GPU-friendly animations.
- **Cache everything safe to cache:** CDN + HTTP caching + ETags + immutable assets.

---

## 8.2 Frontend Budgets (per route, gzip)

- **Initial JS:** ≤ **180 KB**  
- **Initial CSS:** ≤ **35 KB**  
- **Image LCP candidate:** ≤ **120 KB** (AVIF/WebP preferred)  
- **Fonts (all combined first paint):** ≤ **100 KB** WOFF2 (or **1 variable font**, 2 axes)  
- **3rd-party scripts:** **0 by default**; any addition must prove value and load **async/defer** + after consent.

**RUM Goals (p75):**
- **LCP:** < **2.5 s**
- **INP:** < **200 ms**
- **CLS:** < **0.10**

Store route budgets in `config/perf-budgets.json` and enforce in CI.

~~~json
{
  "home": { "js": 180000, "css": 35000, "lcpImage": 120000 },
  "station": { "js": 200000, "css": 40000, "lcpImage": 150000 }
}
~~~

---

## 8.3 Build & Code Splitting (Vite)

- Split by **route/feature**, not by file.
- Keep **shared deps** in a separate vendor chunk only if it reduces duplication.
- Avoid importing heavy libs at the **entry**; use dynamic `import()`.

**Vite config sketch:**
~~~ts
// vite.config.ts
import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react(), splitVendorChunkPlugin()],
  build: {
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        // Optional guardrails, don't over-fragment
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("scheduler")) return "react";
            if (id.includes("lodash-es")) return "lodash";
          }
        }
      }
    }
  }
});
~~~

**Route-level dynamic import:**
~~~tsx
const StationPage = React.lazy(() => import("./pages/StationPage"));
~~~

---

## 8.4 Images (LCP-friendly)

- Use **AVIF/WebP** with **width descriptors** and `sizes`.
- Mark the **LCP image** with `fetchpriority="high"` and **preload** it.
- Lazy-load offscreen images (`loading="lazy"`) and decode async.

~~~tsx
<img
  src="/img/heroes/hero.avif"
  srcSet="/img/heroes/hero-800.avif 800w, /img/heroes/hero-1200.avif 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  width="1200" height="800"
  alt={t("home.hero.alt")}
  decoding="async"
  fetchpriority="high"
/>
~~~

---

## 8.5 Fonts

- Prefer **system stack**. If branding requires custom:
  - **Subset** to used glyphs; use **WOFF2** or **variable font**.
  - `font-display: swap` (or `optional` for non-critical).
  - Preload only **one** critical face.

~~~css
@font-face{
  font-family:"AcmeVar";
  src:url("/fonts/AcmeVar.woff2") format("woff2");
  font-weight:100 700;
  font-display:swap;
}
:root{ --font-sans: "AcmeVar", ui-sans-serif, system-ui; }
body{ font-family: var(--font-sans); }
~~~

---

## 8.6 CSS Strategy

- Tailwind tree-shakes by default; keep **global CSS tiny**.
- Inline **critical CSS vars** (themes) to avoid FOUC (see §5.7).
- Split large feature styles with the component chunk.
- Avoid massive `:global` rules; prefer component scoping.

---

## 8.7 3rd-Party Scripts Policy

- Block by default; require a **justification** and size impact note.
- Load with `async`/`defer`; **no document.write**.
- Disable on slow-mode (Data Saver) or behind a **consent gate**.
- Sandbox iframes; use **off-main-thread** SDKs when possible.

---

## 8.8 Resource Hints & Prefetch

- **Preload**: primary font, LCP image, critical above-the-fold script.
- **Prefetch**: next likely route bundle (on hover/idle).
- **DNS-prefetch / preconnect**: for critical cross-origin APIs/CDNs.

~~~html
<link rel="preload" href="/fonts/AcmeVar.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://api.example.com" crossorigin>
~~~

---

## 8.9 Animations & Scrolling

- Use **transform/opacity** for animations (GPU friendly).
- Respect `prefers-reduced-motion`; provide non-animated alternative.
- Avoid parallax/scripted scroll handlers; prefer **IntersectionObserver**.

~~~css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
~~~

---

## 8.10 Caching, CDN & Compression

- **Static assets**: hashed filenames, `Cache-Control: public, max-age=31536000, immutable`.
- **HTML/JSON**: short max-age + ETag; rely on revalidation.
- Serve **Brotli** (`br`) and **gzip** fallbacks; HTTP/2 or HTTP/3.
- Use **ETag** + conditional GET for APIs.

~~~ts
// apps/backend/src/plugins/perf.ts
import fastifyCompress from "@fastify/compress";
import fastifyEtag from "@fastify/etag";
import fastifyCaching from "@fastify/caching";
export default async function (app) {
  await app.register(fastifyCompress, { global: true });
  await app.register(fastifyEtag);
  await app.register(fastifyCaching, { privacy: "public", expiresIn: 60_000 }); // 60s for JSON
}
~~~

---

## 8.11 Backend Performance (Fastify)

- Use **Pino** logging; avoid synchronous work in request handlers.
- Keep handlers thin; move logic to **services**; batch I/O where possible.
- Use **connection pooling** for DB; **timeouts** and **circuit breakers** for upstreams.
- Stream large responses; paginate lists (cursor-based).

~~~ts
// example: time-bound external fetch
const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
~~~

---

## 8.12 Measurement & CI

- **Bundle size** guardrail:
  - Use `bundlesize` or `bundlewatch` against `config/perf-budgets.json`.
- **Lighthouse CI** for lab checks (desktop + mobile).
- **Web Vitals (RUM)**: send p75 to telemetry (no PII).

**Lighthouse CI config:**
~~~json
{
  "ci": {
    "collect": { "numberOfRuns": 3, "settings": { "preset": "mobile" } },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "unused-javascript": ["warn", { "maxLength": 120000 }]
      }
    }
  }
}
~~~

**package.json scripts:**
~~~json
{
  "scripts": {
    "perf:bundle": "bundlewatch --config config/perf-budgets.json",
    "perf:lhci": "lhci autorun",
    "perf:check": "pnpm perf:bundle && pnpm perf:lhci"
  }
}
~~~

---

## 8.13 Profiling Toolkit

- **React Profiler** (DevTools) for commit timings.
- `why-did-you-render` (dev only) to catch useless re-renders.
- **rollup-plugin-visualizer** to inspect chunks.
- Chrome **Coverage** to find unused bytes.

~~~ts
// vite.config.ts (visualizer)
import { visualizer } from "rollup-plugin-visualizer";
export default { build: { rollupOptions: { plugins: [visualizer({ filename: "stats.html" })] } } };
~~~

---

## 8.14 Common Weight-Savers

- Prefer **lodash-es per-method** or native APIs; avoid full lodash.
- Replace moment.js with **date-fns** or **Intl**.
- Tree-shakeable icon sets (inline SVGs) over giant icon fonts.
- Avoid polyfills unless target browsers truly need them (use `browserslist`).

---

## 8.15 Agent Recipes

### A) A route exceeds JS budget
1. Run visualizer; identify heavy chunk(s).
2. Split the feature (dynamic import) or replace the heavy lib.
3. Defer non-critical widgets behind `IntersectionObserver` or a “More details” expander.
4. Re-measure, update tests, and add a decision log note.

### B) LCP is slow on mobile
1. Compress/resize the LCP image; switch to AVIF/WebP.
2. Add `fetchpriority="high"` and `<link rel="preload">`.
3. Reduce blocking CSS/JS on the initial route; lazy-load below-the-fold.
4. Confirm via WebPageTest/Lighthouse and production RUM.

### C) Interaction jank (INP)
1. Identify long tasks (>50 ms) in Performance panel.
2. Move heavy work off the main thread (Worker) or debounce.
3. Use `useTransition` for low-priority updates; avoid synchronous state waterfalls.

---

## 8.16 Quick Checklist (for this section)

- Do routes meet **JS/CSS budgets** and pass **Lighthouse CI**?
- Is the **LCP image** optimized, preloaded, and right-sized?
- Are non-critical components **code-split** and loaded on demand?
- Are assets cached with **immutable** headers and compressed (br/gzip)?
- Are we tracking **LCP/INP/CLS** p75 in production and failing CI on regressions?

# 9) Accessibility & UX Rules

> **Goal:** Ship interfaces that are usable with keyboard and assistive tech, readable under different themes, and friendly to motion/contrast needs. Accessibility is a **requirement**, not a nice-to-have.

## 9.1 Principles

- **Semantics first**: Use the right HTML element before adding ARIA. Native beats custom.
- **Keyboard parity**: Everything you can click, you can tab to and activate.
- **Perceivable**: Sufficient color contrast and clear focus outlines in all themes.
- **Robust**: Works with screen readers, zoom, high contrast, reduced motion.
- **Announce changes**: Live regions for async updates and validation errors.
- **Localize**: A11y text (labels, alt, titles) follows the i18n system.

---

## 9.2 Keyboard Support Matrix

- **Tab / Shift+Tab**: Move focus forward/backward.
- **Enter / Space**: Activate buttons/links/controls.
- **Esc**: Close dialogs/menus/tooltips and return focus to trigger.
- **Arrows**: In composite widgets (menus, listbox, tabs, sliders).
- **Home/End**: Jump to first/last item in lists where relevant.

> Provide visible focus (`:focus-visible`) that meets contrast and is not removed.

~~~css
:where(button, [role="button"], a, input, textarea, [tabindex])::before { /* no-op placeholder to avoid reset collisions */ }
:where(:focus-visible){
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
~~~

---

## 9.3 Semantics & Roles

- Prefer:
  - `<button>` over clickable `<div>`.
  - `<a href>` for navigation.
  - `<label for>` for inputs.
- Add ARIA only when **native semantics are insufficient**.
- Use `aria-disabled="true"` (not `disabled`) on non-form controls you still want focusable.

---

## 9.4 Focus Management Patterns

- **Initial focus**: On dialog open, move focus to the first interactive element or the dialog itself.
- **Focus trap**: Keep focus inside modal dialogs while open.
- **Return focus**: Restore to the trigger on close.
- **Skip link**: Add a skip-to-content link at the top.

~~~tsx
{/* Skip link */}
<a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
<main id="main">...</main>
~~~

---

## 9.5 Common Widget Recipes

### Dialog (Modal)
- Roles: `role="dialog"` or `role="alertdialog"`, `aria-modal="true"`, labelled by a title.
- Keyboard: trap, Esc closes, return focus to trigger.

~~~tsx
// Dialog.tsx (essentials)
export function Dialog({ open, onClose, titleId, children }: { open: boolean; onClose(): void; titleId: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">Dialog title</h2>
      {/* focus trap + content */}
      {children}
    </div>
  );
}
~~~

### Menu / Menu Button
- Trigger is a button; menu uses `role="menu"`, items use `role="menuitem"`.
- Arrow keys navigate; Home/End jump; Esc closes and returns focus.

### Tabs
- `role="tablist"`, tabs are `role="tab"` with `aria-selected`, panels are `role="tabpanel"` with `aria-labelledby`.
- Left/Right or Up/Down to move; Enter/Space to activate.

~~~tsx
<button role="tab" aria-selected={isActive} aria-controls={panelId} id={tabId}>Overview</button>
<div role="tabpanel" id={panelId} aria-labelledby={tabId} hidden={!isActive}>...</div>
~~~

### Accordion
- Buttons controlling sections: `aria-expanded`, `aria-controls`.
- Panels use `role="region"` with `aria-labelledby`.

### Listbox / Combobox (autocomplete)
- Use the ARIA pattern rigorously or delegate to a proven library.  
- `role="combobox"` + `aria-expanded`, input has `aria-controls` to the popup list, active item referenced by `aria-activedescendant`.

### Toggle Button / Switch
- Toggle: `<button aria-pressed={state}>`.
- Switch: `role="switch" aria-checked={state}`; still keyboard-activatable.

---

## 9.6 Forms & Validation

- Every input needs a **programmatic label** (`<label for>` or `aria-label`).
- Associate errors with fields via `aria-describedby`.
- Validation messages land in a live region and are keyboard reachable.

~~~tsx
<label htmlFor="email">{t("forms.email.label")}</label>
<input id="email" name="email" aria-describedby="email-error" />
<p id="email-error" role="alert">{t("forms.email.invalid")}</p>
~~~

- Group related fields with `<fieldset><legend>…</legend></fieldset>`.

---

## 9.7 Motion & Preference

- Respect `prefers-reduced-motion`. Provide non-animated states and disable parallax/auto-scrolling.

~~~css
@media (prefers-reduced-motion: reduce){
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
~~~

- Avoid motion that implies direction in RTL locales unless mirrored.

---

## 9.8 Color, Contrast & Theming

- Minimum contrast: **4.5:1** for normal text, **3:1** for large text/icons, **3:1** for focus outlines.
- Validate theme token pairs in CI (see §5.10).
- Never communicate state **only** by color; add icons/text.

---

## 9.9 Media: Images, Icons, Video

- **Images**: Provide meaningful `alt`. If decorative, `alt=""` and `role="presentation"`.
- **Icons**: If they convey meaning, provide `aria-label` or visible text; otherwise mark decorative.
- **Video/Audio**: Provide captions/transcripts; don’t autoplay with sound; respect reduced motion.

---

## 9.10 Live Regions & Announcements

- Use `aria-live="polite"` for non-critical updates; `assertive` sparingly.
- Announce async events (e.g., “Saved”, “3 new results”).

~~~tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>
~~~

---

## 9.11 Loading, Empty, Error States

- Loading: skeletons with accessible names (`aria-busy` on container if appropriate).
- Empty: explain next steps; don’t just show “No data”.
- Error: friendly message + retry action; error details logged silently.

---

## 9.12 Responsive & Zoom

- Layouts must remain functional at **200% zoom** and on small screens.
- Avoid horizontal scrolling for text blocks; use fluid typography and wrapping.

---

## 9.13 Linting & Testing

- Enable `eslint-plugin-jsx-a11y`; treat violations as errors for primitives.
- Component tests:
  - **Keyboard**: can tab to/through, activate, and return focus.
  - **Roles/Names**: `getByRole("button", { name: /save/i })`.
  - **Announcements**: verify live region messages on async outcomes.

~~~ts
// Button.test.tsx (example)
user.tab(); // focuses the button
await user.keyboard("{Enter}");
expect(onPress).toHaveBeenCalled();
~~~

- E2E: run with a screen reader-like strategy (query by role/name), test tab order and dialog focus trap.

---

## 9.14 Documentation & API Notes

- Each reusable component has a **README** with:
  - Keyboard behavior
  - Roles/ARIA used
  - Required labels/props
  - Examples for reduced motion and high contrast

---

## 9.15 Do & Don’t

**Do**
- Use native elements first
- Keep focus visible and logical
- Provide ARIA labels/names
- Announce async updates
- Validate contrast in CI

**Don’t**
- Hide focus outlines
- Use divs for buttons/links
- Rely on color alone
- Autoplay media with sound
- Animate essential motion for users with reduced motion

---

## 9.16 Quick Checklist (for this section)

- Does every interactive control have keyboard support and a visible focus?
- Are roles/names/labels correct and testable with `getByRole`?
- Do dialogs/menus trap focus and return it on close?
- Do themes maintain contrast and focus visibility?
- Are validation and async updates announced via live regions?

# 10) Testing Strategy

> **Goal:** Catch regressions early with fast feedback. Favor black-box tests and user-visible behavior over implementation details.

## 10.1 Test Pyramid (Monorepo)

- **Unit** (fast, many): pure functions, small modules (Vitest).
- **Component/DOM** (medium): React components via Testing Library (Vitest).
- **Integration/API** (medium): backend routes/services with real plugins (Vitest + supertest/fastify.inject).
- **E2E** (few, critical): user flows in the browser (Playwright).
- **Contract/Schema** (cross-cutting): Zod/JSON Schema validation for requests/responses.

Targets (guidelines, not dogma):
- Packages (utils/types): **>90%** lines
- UI primitives: **>90%** lines + a11y assertions
- Feature components & backend routes: **>80%**
- Entire repo (blended): **≥85%**

---

## 10.2 Tooling

- **Runner:** Vitest across apps/packages (unified).
- **DOM:** @testing-library/react + @testing-library/user-event.
- **Network mocks:** MSW (browser & node).
- **E2E:** Playwright (chromium + webkit + firefox; desktop & mobile).
- **Coverage:** v8 provider with thresholds.
- **Lint:** eslint-plugin-testing-library & eslint-plugin-jest-dom.

---

## 10.3 File Layout & Naming

~~~txt
packages/<pkg>/
  src/
    foo.ts
    foo.test.ts           # co-located
apps/frontend/
  src/components/Button/Button.tsx
  src/components/Button/Button.test.tsx
  e2e/
    login.spec.ts
apps/backend/
  src/routes/stations.ts
  src/routes/stations.test.ts
tests/
  setup/
    vitest.setup.ts       # globals, jest-dom, msw server
    msw.handlers.ts
~~~

- Tests co-located with code (or `__tests__/` if preferred for large features).
- Snapshots: only for **stable** markup (icons) or serialized data—keep small.

---

## 10.4 Config (Vitest)

**`vitest.config.ts` (root skeleton)**
~~~ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ["**/*.test.tsx", "jsdom"], // DOM tests
      ["**/*.test.ts", "node"]    // pure/node tests
    ],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "lcov"],
      statements: 0, branches: 0, functions: 0, lines: 0 // thresholds enforced in CI
    }
  }
});
~~~

**`tests/setup/vitest.setup.ts`**
~~~ts
import "@testing-library/jest-dom";
import { server } from "./msw.server";
// Start MSW (node) for tests that hit fetch
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
~~~

---

## 10.5 Component Testing (React)

- Test **behavior** via roles/names (`getByRole`, `getByLabelText`)—not class names.
- Prefer **user-event** over `fireEvent`.
- Cover keyboard & a11y states (focus, `aria-*`).
- Avoid testing internal state or private functions.

Example:
~~~tsx
import { render, screen } from "@testing-library/react";
import user from "@testing-library/user-event";
import { Button } from "./Button";

it("fires onPress and is keyboard accessible", async () => {
  const onPress = vi.fn();
  render(<Button onPress={onPress}>Save</Button>);
  const btn = screen.getByRole("button", { name: /save/i });
  await user.click(btn);
  expect(onPress).toHaveBeenCalledTimes(1);

  btn.focus();
  await user.keyboard("{Enter}");
  expect(onPress).toHaveBeenCalledTimes(2);
});
~~~

---

## 10.6 MSW for Network

- Define handlers per domain; re-use in unit/integration/e2e (Playwright has MSW too).

**`tests/setup/msw.handlers.ts`**
~~~ts
import { http, HttpResponse } from "msw";
export const handlers = [
  http.get("/api/stations", () => HttpResponse.json([{ id: "st1", name: "Central" }]))
];
~~~

**`tests/setup/msw.server.ts`**
~~~ts
import { setupServer } from "msw/node";
import { handlers } from "./msw.handlers";
export const server = setupServer(...handlers);
~~~

Override per test:
~~~ts
import { server } from "../../tests/setup/msw.server";
server.use(http.get("/api/stations", () => HttpResponse.json([])));
~~~

---

## 10.7 Backend Integration (Fastify)

- Spin up an **in-memory** fastify instance with real plugins; hit `fastify.inject`.

~~~ts
import Fastify from "fastify";
import routes from "../routes/stations";

it("GET /stations/:id -> 404", async () => {
  const app = Fastify();
  await app.register(routes);
  const res = await app.inject({ method: "GET", url: "/stations/unknown" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toMatchObject({ error: { code: "STATION_NOT_FOUND" } });
});
~~~

---

## 10.8 Contract/Schema Tests

- Validate **inputs/outputs** with Zod or JSON Schema to catch drift.
- Generate **type tests** against `shared-types`.

~~~ts
import { Station } from "@shared-types/station";
it("parses station payload", () => {
  expect(() => Station.parse({ id: "st1", name: "Central", lineId: "L1", lat: 1, lon: 2 })).not.toThrow();
});
~~~

Optional provider/consumer contracts (e.g., Pact) if multiple services.

---

## 10.9 E2E with Playwright

- Critical flows only (auth, search, CRUD happy path).
- Use **projects** for desktop & mobile; run headless in CI; record traces on failure.

**`playwright.config.ts` (skeleton)**
~~~ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "apps/frontend/e2e",
  retries: 1,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } }
  ],
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]]
});
~~~

Example:
~~~ts
import { test, expect } from "@playwright/test";

test("user can search stations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: /search/i }).fill("Central");
  await page.getByRole("button", { name: /search/i }).click();
  await expect(page.getByRole("row", { name: /Central/i })).toBeVisible();
});
~~~

---

## 10.10 Coverage & Thresholds (CI)

- Enforce per-group thresholds in CI (keep config centralized in `config/test-thresholds.json`).

**`config/test-thresholds.json`**
~~~json
{
  "global": { "lines": 85, "statements": 85, "functions": 80, "branches": 75 },
  "packages": { "lines": 90 },
  "ui-primitives": { "lines": 90 },
  "apps": { "lines": 80 }
}
~~~

- Script reads coverage from `coverage/coverage-final.json` and fails if below target.

---

## 10.11 CI Workflow

- Run unit/component tests on every push; E2E on PRs and `main`.
- Upload **coverage** and **Playwright traces** as artifacts.
- Example steps (GitHub Actions):

~~~yaml
name: ci
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - run: pnpm i --frozen-lockfile
      - run: pnpm -w typecheck
      - run: pnpm -w lint
      - run: pnpm -w test -- --coverage
      - run: pnpm -w build
  e2e:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - run: pnpm i --frozen-lockfile
      - run: pnpm -w dev & npx wait-on http://localhost:5173
      - run: pnpm -w e2e
      - uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report }
~~~

---

## 10.12 Test Data & Fixtures

- Use **factory functions** (not giant JSON dumps). Keep fixtures small and explicit.
- Randomness: seed or avoid; tests must be **deterministic**.
- Date/time: use **fake timers** or inject a clock util.

~~~ts
const makeStation = (over: Partial<Station> = {}): Station => ({
  id: "st1",
  name: "Central",
  lineId: "L1",
  lat: 0, lon: 0,
  ...over
});
~~~

---

## 10.13 Flakiness Guardrails

- Avoid `setTimeout` in tests; use **await screen.findBy...** with timeouts.
- Network: MSW only; never hit the real network in unit/component tests.
- E2E: wait by **role/text** becoming visible, not arbitrary sleeps.

---

## 10.14 Visual Regression (Optional)

- If needed, add **Playwright snapshots** or a service (Percy/Chromatic).
- Snapshot only **stable** UIs (primitives). Ignore dynamic regions.

---

## 10.15 Do & Don’t

**Do**
- Test user-visible behavior & a11y roles
- Mock network with MSW
- Keep tests fast and deterministic
- Validate schemas/contracts
- Run E2E for critical flows only

**Don’t**
- Assert on implementation details
- Rely on test IDs where a role/name exists
- Overuse snapshots
- Share giant global stores/fixtures

---

## 10.16 Agent Recipes

### A) Add a Component Test
1. Create `<Name>.test.tsx` next to the component.
2. Render via Testing Library; assert by **role/name**.
3. Cover mouse/keyboard; verify a11y attributes.

### B) Add an API Route Test
1. Spin up Fastify app in the test file.
2. Hit `fastify.inject` with inputs; assert status/body.
3. Validate payload with shared schema.

### C) Add an E2E Test
1. Create `apps/frontend/e2e/<flow>.spec.ts`.
2. Use role/name selectors; record trace on failure.
3. Run locally `pnpm -w e2e` and in CI on PR.

# 11) Logging, Telemetry & Error Boundaries

> **Goal:** Capture actionable signals (errors, events, performance) without leaking PII, with clear ownership and traceability across frontend and backend.

## 11.1 Principles

- **Structured > string**: Logs/events are structured JSON with stable fields.
- **Correlation by default**: Every request and client action carries a `requestId` / `traceId`.
- **Least data, most value**: No PII in logs. Hash/round or drop sensitive values.
- **Consent-aware**: Telemetry respects user consent and legal basis (see §12).
- **Sampling & cost control**: Sample noisy signals; keep storage bounded with retention and rotation.

---

## 11.2 Frontend Error Boundaries

- Wrap route trees/feature roots with **Error Boundaries**. Show a friendly fallback and report the error (without PII).
- Capture: error message, component stack, route, app version, `requestId` (if present), user consent flags.

~~~tsx
// apps/frontend/src/app/ErrorBoundary.tsx
import React from "react";
import { reportClientError } from "@/telemetry/report";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    reportClientError({
      type: "react-boundary",
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? <DefaultFallback />;
    return this.props.children;
  }
}

function DefaultFallback() {
  return (
    <div role="alert" className="p-4 rounded bg-[var(--color-surface)]">
      <p>Something went wrong.</p>
      <button onClick={() => location.reload()}>Reload</button>
    </div>
  );
}
~~~

Use it at **layout** level:

~~~tsx
<ErrorBoundary>
  <AppRoutes />
</ErrorBoundary>
~~~

---

## 11.3 Client Telemetry (Events & Web Vitals)

- Minimal client SDK in `@shared-utils/telemetry` with:
  - `track(eventName, props)` for **business events** (non-PII).
  - `captureError(payload)` for **client errors**.
  - `reportVitals(LCP/INP/CLS)` for **CWV** (p75 aggregated server-side).
- Transport: `navigator.sendBeacon` with retry fallback.

~~~ts
// packages/shared-utils/src/telemetry/client.ts
type Base = { ts: number; requestId?: string; appVersion: string };
export function track(name: string, props: Record<string, unknown> = {}) {
  send("/telemetry/events", { ...props, name, ts: Date.now(), kind: "event" } as Base & any);
}
export function captureError(e: { type: string; error: unknown; componentStack?: string }) {
  const safe = normalizeError(e.error); // message, stack trimmed, no PII
  send("/telemetry/errors", { ...e, error: safe, ts: Date.now(), kind: "error" });
}
export function reportVitals(v: { lcp?: number; inp?: number; cls?: number }) {
  send("/telemetry/vitals", { ...v, ts: Date.now(), kind: "vitals" });
}
function send(path: string, body: any) {
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  navigator.sendBeacon?.(path, blob) || fetch(path, { method: "POST", body: JSON.stringify(body), keepalive: true });
}
~~~

- **Consent gate**: client SDK is no-op until consent is granted; store consent choice (cookie/local storage).

---

## 11.4 Backend Logging (Fastify + Pino)

- Log in **JSON** with timestamps, level, `requestId`, and `traceId` (W3C). Redact sensitive fields.
- Levels: `fatal` > `error` > `warn` > `info` > `debug`. Default `info` in prod.

~~~ts
// apps/backend/src/app.ts
import Fastify from "fastify";
import pino from "pino";
const app = Fastify({
  logger: pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "res.headers.set-cookie"
      ],
      remove: true
    },
    formatters: { level(label) { return { level: label }; } }
  }),
  genReqId: () => crypto.randomUUID()
});
app.addHook("onRequest", (req, _reply, done) => {
  // W3C trace propagation
  const traceparent = req.headers["traceparent"] as string | undefined;
  req.log = req.log.child({ requestId: req.id, traceparent });
  done();
});
export default app;
~~~

- **Error shape**: Always log `err` with `type`, `code`, `message`, `stack` (trimmed), plus `requestId`.

~~~ts
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err, requestId: req.id, route: req.routerPath }, "unhandled_error");
  reply.code(500).send({ error: { code: "INTERNAL", message: "Something went wrong" }, requestId: req.id });
});
~~~

---

## 11.5 Tracing & Metrics (OpenTelemetry)

- Use **OTel** to stitch frontend → backend → DB traces.
- Emit **traceparent** from the client (optional) and propagate in backend.
- Capture spans for route handlers and external calls; add attributes (`http.route`, `db.statement` masked).

~~~ts
// apps/backend/src/otel.ts (sketch)
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: process.env.OTLP_URL }),
  instrumentations: [getNodeAutoInstrumentations()]
});
// start in server entrypoint
~~~

- Metrics: process metrics (CPU, RSS), request duration histograms, error counts. Export to your backend (Prometheus/OTLP).

---

## 11.6 Event Schema (Stable Contracts)

- Define a **registry** for analytics events to keep naming stable across apps.

~~~json
{
  "version": 1,
  "events": {
    "search.performed": {
      "props": {
        "query": "string",         // truncated, hashed if sensitive
        "resultsCount": "number"
      }
    },
    "station.viewed": {
      "props": { "stationId": "string" }
    }
  }
}
~~~

- Store in `config/telemetry.events.json`; validate client calls in CI with a script.

---

## 11.7 Privacy, Consent & Redaction

- **No PII** in logs/events: no emails, full names, raw user input (hash or drop), IP addresses (drop), precise geolocation (drop).
- **Consent**:
  - Non-essential analytics only after opt-in.
  - Store `consent.analytics=true|false`; SDK checks before sending.
- **Retention**: default **30 days** for raw logs, longer only for aggregated metrics.
- **Subject rights**: events must be **unlinkable** to a natural person without a separate lawful basis (see §12 for details).

---

## 11.8 Shipping & Storage

- Local/dev: pretty print logs; no telemetry export by default.
- Prod:
  - Logs → stdout → collector (e.g., Loki/ELK).
  - Traces/metrics → OTLP backend.
  - Errors → error tracker (Sentry/Rollbar) **with PII scrubbing enabled**.

**GitHub Actions example (upload artifacts on failure):**
~~~yaml
- name: Upload server logs on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with: { name: server-logs, path: apps/backend/logs/*.ndjson }
~~~

---

## 11.9 Frontend → Backend Correlation

- Backend returns `requestId` header on responses; client attaches it to subsequent error reports so we can join logs.

~~~ts
// client fetch wrapper
export async function api(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const requestId = res.headers.get("x-request-id") ?? undefined;
  // Attach to current context for error/telemetry
  setRequestContext({ requestId });
  return res;
}
~~~

Fastify reply hook:

~~~ts
app.addHook("onSend", (req, reply, _payload, done) => {
  reply.header("x-request-id", req.id);
  done();
});
~~~

---

## 11.10 Sampling Strategies

- **Errors**: 100% of unhandled exceptions; deduplicate identical stacks within a window.
- **Events**: 10–50% sample for high-volume events; 100% for critical flows (auth).
- **Traces**: 5–20% baseline; head-based sampling raised on error rates.

---

## 11.11 Redaction Helpers

- Provide reusable redactors for strings/objects (mask emails, tokens; truncate free-text > 128 chars).

~~~ts
// packages/shared-utils/src/redact.ts
export const redactEmail = (s: string) => s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
export const truncate = (s: string, n = 128) => (s.length > n ? s.slice(0, n) + "…" : s);
export function sanitizeError(err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  return { name: e.name, message: truncate(redactEmail(e.message)), stack: truncate(redactEmail(e.stack ?? "")) };
}
~~~

---

## 11.12 Agent Recipes

### A) Add Error Boundary to a New Feature
1. Create `FeatureErrorBoundary.tsx` using the base boundary.
2. Wrap the feature route root.
3. Add a friendly fallback with a “Try again” action and log via `captureError`.

### B) Log a Backend Error with Context
1. In route, catch domain error and `req.log.warn({ err, requestId: req.id, domain: "stations" }, "station_lookup_failed")`.
2. Return a safe envelope with `requestId`.
3. Add test asserting log call (use pino-transport in test).

### C) Add a New Analytics Event
1. Add spec to `config/telemetry.events.json`.
2. Use `track("search.performed", { query: hash(query), resultsCount })`.
3. Validate in CI with event schema script.

### D) Add a Trace for External Call
1. Wrap upstream call in an OTel span (`name: "GET upstream /foo"`).
2. Add attributes (`net.peer.name`, `http.status_code`).
3. Record errors on span; ensure propagation headers are forwarded.

---

## 11.13 Quick Checklist (for this section)

- Are logs **structured JSON** with `requestId` and proper levels?
- Are client errors caught by **Error Boundaries** and reported without PII?
- Do we respect **consent** and avoid sending telemetry before opt-in?
- Are traces/metrics exported with **sampling** and cost control?
- Can we correlate a frontend error with a backend log via `requestId`?

# 12) Security & Privacy

> **Goal:** Ship secure-by-default apps. Minimize data, validate everything, encode on output, and enforce least privilege across the stack. This section is engineering guidance (not legal advice).

## 12.1 Principles

- **Least privilege**: Minimal permissions, minimal data, minimal exposure.
- **Secure by default**: Deny by default, opt-in for exceptions (CORS, CSP, features).
- **Validate → Authorize → Execute** (in that order).
- **No secrets in code**: Use env/secret managers; commit only `.env.example`.
- **Privacy-first**: Collect the minimum; consent-gate non-essential telemetry (see §11).

---

## 12.2 Secrets & Configuration

- Never commit real secrets. Keep `/.env` out of VCS; ship `.env.example`.
- Use a secrets manager (cloud KMS), or encrypt with **SOPS/age** if secrets must exist in git.
- Rotate keys regularly; version configs; document rollback.
- Validate required envs at boot with Zod.

~~~ts
// apps/backend/src/config/env.ts
import { z } from "zod";
export const Env = z.object({
  NODE_ENV: z.enum(["development","test","production"]),
  PORT: z.string().default("3000"),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
}).transform(v => ({ ...v, PORT: Number(v.PORT) }));
export type Env = z.infer<typeof Env>;
export const env: Env = Env.parse(process.env);
~~~

---

## 12.3 HTTP Security Headers

- Set these on all responses:

  - `Content-Security-Policy` (CSP) — strict defaults
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy` (formerly Feature-Policy)
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp` (only if you need isolation)
  - `Strict-Transport-Security` (HSTS) — prod over HTTPS only
  - `X-Frame-Options: DENY` (or frame-ancestors in CSP)

~~~ts
// apps/backend/src/plugins/security.ts
import fastifyHelmet from "@fastify/helmet";
export default async function security(app) {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'strict-dynamic'"],
        "style-src": ["'self'", "'unsafe-inline'"], // consider CSP nonces if you can
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'"],
        "connect-src": ["'self'", "https://api.example.com"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"]
      }
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" }
  });
}
~~~

> If you inject inline `<script>`, prefer **nonces**. Avoid `unsafe-inline`.

---

## 12.4 Authentication & Session

- **Short-lived access token** + **refresh token** model.
- Store **refresh token** in **httpOnly, Secure, SameSite=Lax** cookie. Access token in memory (not localStorage).
- Rotate refresh tokens; revoke on logout.
- Pin device via a server-side session table (jti + device id).

~~~ts
// cookie options example
reply.setCookie("refresh", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/auth/refresh",
  maxAge: 60 * 60 * 24 * 30 // 30d
});
~~~

- Password hashing: **Argon2id** (or scrypt) with per-user salt; never store plaintext.
- MFA/TOTP optional for privileged actions.

---

## 12.5 Authorization

- Use **RBAC** (roles) + optional **ABAC** (attributes) for fine-grain control.
- Enforce at the **route/service** layer (don’t rely on client hiding).
- Deny by default; explicitly allow per resource/action.

~~~ts
// guard example
function can(user: User, action: "read"|"edit", resource: Resource) {
  if (user.role === "admin") return true;
  if (action === "read" && resource.public) return true;
  return resource.ownerId === user.id && action !== "delete";
}
~~~

---

## 12.6 CSRF, CORS & SameSite

- CSRF:
  - If you rely on cookies for auth, use **SameSite=Lax/Strict** + **CSRF tokens** (double-submit or synchronizer pattern).
  - For APIs consumed by SPAs with Bearer tokens, prefer **no cookies** → CSRF risk is lower (still validate origin).
- CORS:
  - Deny by default. Allow specific origins only, no wildcards with credentials.
  - Preflight cache with low TTL; log rejections.

~~~ts
// apps/backend/src/plugins/cors.ts
import fastifyCors from "@fastify/cors";
app.register(fastifyCors, {
  origin: [/^https:\/\/(www\.)?example\.com$/],
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE"]
});
~~~

---

## 12.7 Input Validation & Output Encoding

- Validate **all inputs** (params, query, body, headers) with Zod/JSON Schema.
- **Never** trust the client; re-validate server-side even if the client has types.
- Encode/escape outputs for the target context (HTML/attr/URL/JS).

~~~ts
// route schema (Fastify)
const Params = z.object({ id: z.string().uuid() });
const Body = z.object({ name: z.string().min(1).max(100) });
fastify.post("/items/:id", async (req, reply) => {
  const params = Params.parse(req.params);
  const body = Body.parse(req.body);
  // ...
});
~~~

---

## 12.8 XSS & DOM Safety

- **Never** inject untrusted HTML. Avoid `dangerouslySetInnerHTML`.
- If you must render HTML (e.g., CMS content), sanitize with **DOMPurify** and use **CSP**.
- Use **Trusted Types** (where supported) to lock down sinks.

~~~tsx
import DOMPurify from "dompurify";
function SafeHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}
~~~

- Escape text in attributes; avoid building HTML strings; prefer JSX.

---

## 12.9 File Uploads & Media

- Limit **size**, **type**, and **count**; reject unknown MIME; check magic bytes.
- Strip EXIF on images; transcode to safe formats server-side.
- Virus-scan (e.g., ClamAV) in background if needed; quarantine on fail.
- Store with random names; do not serve from upload folder directly.

---

## 12.10 SSRF, Path Traversal, & Command Injection

- SSRF:
  - Deny outbound requests by default; whitelist hostnames/IP ranges.
  - Disable redirects or limit hops; timeout aggressively.
- Path traversal:
  - Serve static files from a fixed root; **never** join user input into paths without normalization.
- Command injection:
  - Avoid `exec`. If needed, use `spawn` with arg arrays; never interpolate user input into shell strings.

---

## 12.11 Rate Limits, DoS & Body Limits

- Global + per-route rate limits; stricter for auth-sensitive endpoints.
- Body size limits per content type (e.g., JSON ≤ 1MB).
- Timeouts on upstream calls; circuit breakers; backpressure on queues.

~~~ts
// Fastify rate limit (example)
import rateLimit from "@fastify/rate-limit";
app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
~~~

---

## 12.12 Dependency & Supply Chain

- Lockfile committed; **pinned versions**. Avoid `*`/`latest`.
- Enable **Dependabot/Renovate** for updates.
- Scan with `npm audit`, **osv-scanner**, or **Snyk** in CI.
- Review **postinstall/prepare** scripts; avoid running untrusted build steps.
- Verify package integrity and maintainers for critical libs.

---

## 12.13 Browser Permissions & Isolation

- Use `Permissions-Policy` to disable unused features (camera, geolocation, usb, etc.).
- Sandbox iframes; set `allow` list to minimum.

~~~html
<iframe src="…" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>
~~~

- For cross-window messaging, **validate origin** and shape.

~~~ts
// postMessage listener
window.addEventListener("message", (e) => {
  if (e.origin !== "https://trusted.example.com") return;
  const { type, payload } = e.data ?? {};
  if (type === "select-station" && typeof payload?.id === "string") {
    // handle safely
  }
});
~~~

---

## 12.14 Webhooks & Callbacks

- Validate signature (HMAC with shared secret) and **replay protection** (timestamp + nonce).
- Respond 2xx only after basic validation succeeds; queue heavy work.

~~~ts
// verify HMAC (pseudo)
const sig = req.headers["x-signature"];
const ok = hmacVerify(sig, req.rawBody, process.env.WEBHOOK_SECRET);
if (!ok) return reply.code(401).send();
~~~

---

## 12.15 Data Minimization & Privacy

- Classify data: **public**, **internal**, **personal**, **sensitive**.
- Collect only what you use; set **retention** (auto-delete) by table/index.
- Anonymize/aggregate telemetry; avoid unique identifiers unless necessary.
- Provide a **consent gate** for analytics; remember choice (see §11).
- For EU contexts: support **access/export/delete** on personal data (engineering hooks only; policy lives elsewhere).

---

## 12.16 Logging & Redaction (see §11)

- Strip PII: emails, tokens, cookies, IPs, precise geo.
- Truncate free-text fields; hash if you need correlation without raw value.
- Never log secrets or full request/response bodies for auth endpoints.

---

## 12.17 TLS & Transport

- HTTPS everywhere in prod; redirect HTTP → HTTPS.
- HSTS with preload (after verifying HTTPS stability).
- Use modern TLS ciphers; terminate at the edge/CDN if applicable.

---

## 12.18 CI/CD & Secrets Hygiene

- Use **OIDC** or short-lived deploy keys; avoid long-lived tokens.
- Mask secrets in logs; restrict repo/environment access.
- Separate dev/stage/prod secrets; principle of separation of duties.

---

## 12.19 Security Testing

- **Static**: ESLint security rules, dependency scanning.
- **Dynamic**: basic DAST against staging; fuzz inputs where feasible.
- **Threat modeling**: quick STRIDE checklist per feature/PR.
- **Bug bounty / security.txt** (optional) to receive reports.

---

## 12.20 Incident Basics (Engineering)

- Central on-call contact; rotate.
- Playbook: detect → contain → eradicate → recover → postmortem (with action items).
- Tag related commits/PRs; add to **decision log** (§2.10).

---

## 12.21 Agent Recipes

### A) Add a New Protected Route
1. Validate inputs (Zod) → authenticate (access token) → authorize (RBAC/ABAC).
2. Enforce rate limit & body size.
3. Return a safe error envelope; include `requestId`.

### B) Wire Up CSRF for Cookie-based Session
1. Add SameSite=Lax cookie session.
2. Generate CSRF token on GET; store in cookie; validate header on POST/PUT/PATCH/DELETE.
3. Deny if origin/referrer fails, even with token.

### C) Add CSP Nonce Support
1. Generate a per-response nonce.
2. Add `script-src 'self' 'nonce-<value>' 'strict-dynamic'`.
3. Attach nonce to any inline scripts.

### D) Sanitize User HTML
1. Add DOMPurify with a conservative allowlist.
2. Strip scripts/style/event handlers; drop iframes unless sandboxed.
3. Render via a `SafeHtml` component only.

---

## 12.22 Quick Checklist (for this section)

- Secrets out of git and validated at boot?
- Strict CSP, HSTS, and security headers enabled?
- Auth short-lived; refresh in httpOnly cookie with rotation?
- CSRF protected (if cookies) and CORS locked down?
- Inputs validated server-side; outputs encoded; no `dangerouslySetInnerHTML`?
- Uploads constrained and sanitized? SSRF/path traversal guarded?
- Rate limits & timeouts set; dependency scanning in CI?
- Analytics consent-gated; PII redacted from logs?

# 13) Git Hygiene & Release Workflow

> **Goal:** Keep history clean, reviews crisp, and releases boringly reliable across a monorepo.

## 13.1 Branching Model

- **Default branch:** `main` (protected).
- **Feature branches:** `feat/<area>-<short-desc>` (e.g., `feat/ui-button-ghost`).
- **Fix branches:** `fix/<area>-<short-desc>`.
- **Release branches (optional):** `release/vX.Y` for coordinated releases.
- **Merge strategy:** **Squash & merge** into `main` (linear history).
- **Rebase policy:** Rebase locally; never rebase `main`.

Protection rules for `main`:
- Required checks: **typecheck**, **lint**, **test**, **build**, (optionally **perf**).
- Require 1–2 approvals; enforce **CODEOWNERS**.

---

## 13.2 Commit Convention (Conventional Commits)

- Format: `type(scope): summary`
- **Types:** `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scope:** package/app or domain (`ui/button`, `shared-utils`, `backend/auth`).
- Use present tense, no trailing period. Keep summary ≤ 72 chars.

Examples:
~~~txt
feat(ui/button): add ghost variant
fix(station-data): handle missing coordinates
perf(frontend): lazy-load station map widget
docs: add theming section to README
~~~

> Optional enforcement: **commitlint** + Husky `commit-msg` hook.

---

## 13.3 Pull Requests

- **Small, focused PRs** (ideally < 300 lines diff).
- Title follows Conventional Commits (mirrors merge commit).
- Link issue / provide context.

PR checklist (template in `.github/PULL_REQUEST_TEMPLATE.md`):
~~~md
- [ ] Typechecks, lints, tests pass
- [ ] Screenshots (if UI) + a11y notes
- [ ] i18n keys added/updated (if user text)
- [ ] Perf impact considered (bundle size / LCP)
- [ ] Added/updated docs or stories
- [ ] Changeset included for versioning (if user-visible change)
~~~

---

## 13.4 Review Guidelines

- Review behavior, public APIs, and **boundaries** (see §2.8), not nits.
- Prefer comments with **suggested changes**.
- Blockers: security issues, breaking public APIs without plan, red tests.
- Approvals by **owners** for affected areas (CODEOWNERS).

**`CODEOWNERS` (root):**
~~~txt
# Packages
/packages/shared-utils/   @your-org/frontend-core
/packages/shared-types/   @your-org/platform-core
/apps/backend/            @your-org/backend-core
/apps/frontend/           @your-org/frontend-core
~~~

---

## 13.5 Versioning Strategy (Changesets)

- Use **Changesets** for monorepo-aware semantic versioning.
- **Independent** versioning per package (recommended).  
  Alternative: **fixed** versioning for all packages (not recommended here).

**Changeset file** (created via `pnpm changeset`):
~~~md
---
"@metro/shared-utils": minor
"@metro/ui": patch
---

feat: add debounce util; fix Button focus ring in high contrast
~~~

**Config** `.changeset/config.json`:
~~~json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "your-org/your-repo" }],
  "commit": false,
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "minor",
  "ignore": []
}
~~~

> Internal deps use `pnpm`’s `"workspace:*"` ranges. During publish, these are resolved to real versions.

---

## 13.6 Release Automation

- **Flow:**
  1) Devs add changesets in PRs.
  2) On `main`, a bot PR “**Version Packages**” is opened with bumped versions, changelogs, and updated lockfile.
  3) Merge that PR → tags are created and **publish** runs.

**GitHub Action** `.github/workflows/release.yml` (sketch):
~~~yaml
name: release
on:
  push:
    branches: [main]
jobs:
  version-or-publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write # npm provenance (optional)
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - run: pnpm i --frozen-lockfile
      - run: pnpm -w build
      - name: Create or publish release
        uses: changesets/action@v1
        with:
          publish: pnpm -w -r publish --access public
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
~~~

**Tags:** independent mode → npm-style tags per package (e.g., `@metro/ui@1.2.3`).

---

## 13.7 SemVer Rules

- `feat:` → **minor** (unless explicitly marked breaking).
- `fix:`, `perf:` → **patch**.
- **Breaking change**: add `BREAKING CHANGE:` footer in changeset body → **major**.

Example footer:
~~~md
BREAKING CHANGE: Button `size=xl` removed; use `size=lg` with `data-scale=1.1`.
~~~

---

## 13.8 Pre-releases & Channels

- Use **prerelease** mode for betas/canaries:
  - `pnpm changeset pre enter beta`
  - merge changes → publish with `@beta` **dist-tag**
  - `pnpm changeset pre exit` to return to normal.

NPM dist-tags:
- `latest` (stable)
- `beta` / `next` (pre)
- `canary` (CI/nightly; optional)

---

## 13.9 Hotfixes

When a critical bug ships in `@metro/ui@1.2.3`:

1) Branch from tag:
~~~bash
git checkout -b hotfix/ui-1.2.4 @metro/ui@1.2.3
~~~
2) Apply fix; add **patch** changeset for `@metro/ui`.
3) Run CI; merge “Version Packages” PR.
4) Publish → `@metro/ui@1.2.4`.
5) Backport to `main` if hotfix diverged.

---

## 13.10 Changelogs

- Auto-generated per package via Changesets.
- Keep entries **human**: what changed, why, and migration hints.
- Link PRs and contributors (GitHub changelog plugin handles this).

---

## 13.11 Root Files & Meta

- **`.gitignore`** (see §2.7)
- **`.editorconfig`** (see §2.7)
- **`.gitattributes`** (normalize line endings, linguist settings)
~~~gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.avif binary
~~~
- **`.nvmrc` / `.node-version`** to pin Node
- **`.npmrc`** (optional) to enable provenance and lock registry
~~~npmrc
engine-strict=true
@your-org:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
publish-branch=main
~~~

- **Issue/PR templates** in `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md`.

---

## 13.12 Husky & Lint-Staged (Local Hygiene)

- **Pre-push:** `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- **Pre-commit (optional):** lint-staged for fast feedback

**`.husky/pre-commit`**
~~~bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
~~~

**`lint-staged.config.js`**
~~~js
export default {
  "*.{ts,tsx}": ["eslint --fix", "vitest related --run"],
  "*.md": ["markdownlint --fix"]
};
~~~

---

## 13.13 Monorepo Dependency Rules

- Internal deps use `"workspace:*"`; external deps are pinned (`^x.y.z`).
- No cross-package **deep imports** (enforced via ESLint).
- Avoid circular deps; use **public APIs** from `src/index.ts`.

---

## 13.14 Release Readiness Checklist

Before merging a release PR (“Version Packages”):

- [ ] CI green (build, tests, typecheck, lint)
- [ ] Changelogs make sense & include migration notes
- [ ] Version bumps are correct (no accidental majors)
- [ ] Docs updated if APIs changed
- [ ] Owners approved (CODEOWNERS)

---

## 13.15 Agent Recipes

### A) Add a Changeset for a Fix
1. `pnpm changeset` → choose packages → **patch**.
2. Write a short human message.
3. Commit the changeset file with your PR.

### B) Publish a Beta of `@metro/ui`
1. `pnpm changeset pre enter beta`
2. Merge PRs with changesets.
3. On `main`, Changesets bot opens version PR → merge.
4. Publish: `pnpm -w -r publish --tag beta`
5. `pnpm changeset pre exit`

### C) Create a Hotfix Patch
1. Branch from the last stable tag.
2. Apply fix, add patch changeset, PR → merge.
3. Publish; tag appears as `@metro/ui@x.y.z`.

---

## 13.16 Quick Checklist (for this section)

- Are commits/PRs following **Conventional Commits**?
- Is `main` protected with required checks and CODEOWNERS?
- Are changesets added for user-visible changes?
- Is publishing automated and using **independent** versions?
- Are release notes/changelogs generated and readable?

# 14) Code Generation & Refactor Playbooks (for the Agent)

> **Goal:** Give the agent clear, low-risk, step-by-step recipes to scaffold features, move code safely, and keep the repo consistent.

## 14.1 Principles

- **Automate the boring**: prefer scripts over manual edits.
- **Small, reversible steps**: each playbook ends in a green CI state.
- **Boundaries matter**: never break §2.8 import rules.
- **Docs or it didn’t happen**: add a line to §2.10 Decision Log when architecture changes.

---

## 14.2 Repo Scaffolding Helpers (recommended)

> (Optional) Add these tiny scripts under `/scripts` to make the playbooks deterministic.

- `new-package.ts` — create a typed package with build config
- `new-component.ts` — scaffold a component folder with tests
- `new-feature.ts` — feature skeleton (api/hooks/components/state)
- `migrate-to-package.ts` — promote an app component to `packages/ui`
- `add-locale-keys.ts` — add keys to all languages
- `add-theme.ts` — clone theme and validate
- `codemod-aliases.ts` — rewrite imports to aliases

Each script should:
- be idempotent,
- log steps,
- fail fast with actionable errors.

---

## 14.3 Playbooks

### A) Create a New Package

**When:** you need a reusable lib (utils, ui, types, data) consumed by multiple apps.

1. Create folder & files:
~~~txt
packages/<name>/
  src/index.ts
  package.json
  tsconfig.json
  README.md
~~~
2. `package.json` (template)
~~~json
{
  "name": "@metro/<name>",
  "version": "0.0.0",
  "private": false,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint ."
  },
  "files": ["dist"]
}
~~~
3. `tsconfig.json` (extends root)
~~~json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" }, "include": ["src"] }
~~~
4. Export **only** from `src/index.ts`.  
5. Register in `pnpm-workspace.yaml`.  
6. Run `pnpm -w build && pnpm -w typecheck`.  
7. Add decision: “Created `@metro/<name>` package for …”.

---

### B) Add a New Primitive Component (app-local or @metro/ui)

1. Scaffold:
~~~txt
<root>/[apps/frontend|packages/ui]/src/components/<Name>/
  <Name>.tsx
  <Name>.types.ts
  <Name>.test.tsx
  README.md
  index.ts
~~~
2. Implement per §4 (props, a11y, tokens, data-attrs).  
3. Export from parent `src/components/index.ts` (if present).  
4. Add stories (optional).  
5. Run tests + lint.  
6. If generic and used by 2+ apps → see **G) Promote Component to Package**.

---

### C) Add a Feature (frontend)

1. Create:
~~~txt
apps/frontend/src/features/<feature>/
  api/
  hooks/
  components/
  state/          # optional zustand store
  index.ts
~~~
2. API functions call backend via shared client; parse with Zod.  
3. Hooks wrap TanStack Query; expose `use<Feature>()`.  
4. Components consume hooks; no fetching in primitives.  
5. Add route/page under `src/pages/` (thin).  
6. Tests: hook (success/error), component behavior.  
7. Update docs if user-facing.

---

### D) Add Locale Keys

1. Add to `/locales/en/<ns>.json` first (semantic key).  
2. Run script to fan out to other languages (empty or `TODO`).  
3. If app-specific override needed, add in `apps/<app>/locales/<lang>/<ns>.json`.  
4. Run `pnpm i18n:lint && pnpm validate:config`.

---

### E) Add a New Theme

1. Copy `config/themes/light.json` → `config/themes/<name>.json`.  
2. Edit `name` and `semantic.color.*` first.  
3. Run `pnpm validate:config` + contrast checker (§5.10).  
4. Select it in `apps/<app>/theme.config.json`.  
5. Add a decision log note.

---

### F) Introduce a Feature Flag

1. Add flag in `config/settings/features.json`:
~~~json
{ "myNewFlag": false }
~~~
2. Optionally override in `apps/<app>/app.config.json`.  
3. Access via a tiny settings loader:
~~~ts
import { getSetting } from "@shared-utils/settings";
if (getSetting("featureFlags.myNewFlag")) { /* render feature */ }
~~~
4. Include analytics to measure usage (non-PII).  
5. Add cleanup task to remove flag when stable.

---

### G) Promote Component from App → `packages/ui`

1. Verify it’s generic (no app-specific imports, no hardcoded copy).  
2. Move folder to `packages/ui/src/components/<Name>/`.  
3. Replace local imports with alias: `@metro/ui`.  
4. Export in `packages/ui/src/index.ts`.  
5. Run codemod to rewrite imports in apps:
~~~bash
# Example find+sed (adjust for OS)
rg "from ['\"]@/components/<Name>['\"]" -l apps | xargs sed -i '' "s|@/components/<Name>|@metro/ui|g"
~~~
6. Run `pnpm -w build && pnpm -w typecheck && pnpm -w test`.  
7. Add changeset if publishing; update decision log.

---

### H) Split a Package (extract node-specific utils)

1. Create `@metro/shared-utils-node`.  
2. Move Node-only modules (`fs`, `path`, `os`) there.  
3. Update imports in consumers to new package.  
4. Enforce isomorphic rule in `@metro/shared-utils` (lint).  
5. Tests + build + changeset.

---

### I) Add a Backend Route (Fastify)

1. Define types in `@metro/shared-types` (request/response Zod).  
2. Implement service code (pure) → import into route.  
3. Route:
~~~ts
fastify.get("/v1/items/:id", { schema: {/* zod or json schema */} }, async (req, reply) => {
  const data = await services.items.getById(req.params.id);
  if (!data) return reply.code(404).send({ error: { code: "NOT_FOUND" }});
  reply.header("ETag", etag(data)).send(data);
});
~~~
4. Add tests via `fastify.inject`.  
5. Document endpoint (OpenAPI or README).  
6. Add ETag + caching headers if safe.

---

### J) Add Config Setting (Routes / Visibility / Links)

1. Add field under `config/settings/defaults.json`, e.g.:
~~~json
{ "routes": { "help": "/help", "feedback": "https://…" }, "ui": { "hideElements": ["betaBadge"] } }
~~~
2. Update `settings.schema.json`.  
3. If app-specific override, add in `apps/<app>/app.config.json`.  
4. Access via settings util; **never** hardcode links in components.  
5. Validate & run CI.

---

### K) Add/Change Import Aliases

1. Update `tsconfig.base.json` `paths`:
~~~json
"@shared-utils/*": ["packages/shared-utils/src/*"],
"@app/*": ["apps/*/src/*"]
~~~
2. Run codemod to replace relative paths with aliases.  
3. Ensure ESLint import resolver has `typescript: true`.  
4. Build & typecheck.

---

### L) Deprecate a Public API

1. Add JSDoc `@deprecated` with replacement guidance.  
2. Export a wrapper that warns in dev:
~~~ts
/** @deprecated use doThing2 */
export function doThing() { if (DEV) console.warn("doThing is deprecated; use doThing2"); return doThing2(); }
~~~
3. Migrate internal usages via codemod.  
4. Note in Changeset (minor) + changelog.  
5. Plan removal after 1–2 minors.

---

### M) Introduce a URL Param / State in the URL

1. Define schema for query params.  
2. Use the `useQueryParams` helper (§7.7).  
3. Reflect UI state (filters/sort/page) in the URL.  
4. Add tests to ensure sharing the URL recreates state.

---

### N) Add a Storybook Story (if used)

1. Co-locate `<Name>.stories.mdx` with the component.  
2. Include a **Controls** table and **A11y** notes.  
3. Add a **Recipe** story showing composition with other primitives.  
4. Ensure tokens/themes switch via toolbar.

---

## 14.4 Codemod Cheats (jscodeshift/ts-morph)

> Use codemods for consistent, large-scale refactors.

- **Default → Named export** conversion
- **Relative → Alias** import rewrite
- **Prop rename** (e.g., `onClick` → `onPress`)
- **Enum → union** transform

Track each codemod in `scripts/codemods/<name>.md` with:
- intent, before/after, dry-run output, rollback steps.

---

## 14.5 Validation After Each Playbook

After any automated change, run:

~~~bash
pnpm -w typecheck
pnpm -w lint
pnpm -w test
pnpm -w build
pnpm -w validate:config
~~~

If themes/locales changed, also run:
~~~bash
pnpm perf:bundle    # optional
pnpm i18n:lint
pnpm scripts/check-contrast
~~~

---

## 14.6 Commit & PR Templates (quick paste)

**Commit (Conventional)**
~~~txt
feat(ui/button): add ghost variant
fix(shared-utils): handle null in formatDate
refactor(frontend): replace deep imports with aliases
~~~

**PR body**
~~~md
## Summary
Short explanation of what/why.

## Checklist
- [ ] Typecheck/lint/test/build pass
- [ ] i18n keys validated
- [ ] Config/schema updated (if applicable)
- [ ] Docs/stories updated
- [ ] Changeset added (if user-visible)
~~~

---

## 14.7 Quick Checklist (for this section)

- Did you use a **playbook** (not ad-hoc steps)?
- Are package boundaries & aliases respected?
- Did scripts validate **settings/themes/locales**?
- Did you update the **decision log**?
- Is there a **changeset** if the public API changed?

# 15) Do/Don’t Cookbook

> **Goal:** Quick, opinionated rules with tiny examples. When in doubt, copy the “Do”.

---

## 15.1 TypeScript

**Do**: use strict, explicit types; prefer `unknown` + narrowing.
**Don’t**: use `any`, widen types, or rely on inference for APIs.

~~~ts
// Do
type StationId = string;
function parseId(id: unknown): StationId {
  if (typeof id !== "string") throw new Error("id must be string");
  return id;
}

// Don’t
function parseId(id: any) {
  return id as string;
}
~~~

---

## 15.2 Components & Props

**Do**: explicit props, controlled inputs, accept `className`, forward refs when needed.  
**Don’t**: dump everything into one mega-prop object or rely on context for basics.

~~~tsx
// Do
type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string; onChange(value: string): void; label: string;
};
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ value, onChange, label, className, ...rest }, ref) => (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        ref={ref}
        className={cn("rounded", className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </label>
  )
);

// Don’t
export const TextField2 = (props: any) => <input {...props} />;
~~~

---

## 15.3 Styling & Tokens

**Do**: style via tokens (CSS vars) and data-attributes for variants/sizes.  
**Don’t**: hardcode colors or sprinkle inline styles everywhere.

~~~tsx
// Do
<button className="text-[var(--color-on-primary)] bg-[var(--color-primary)]" data-variant="primary" />

// Don’t
<button style={{ color: "#fff", background: "#2563eb" }} />
~~~

---

## 15.4 i18n

**Do**: ICU messages, semantic keys, no concatenation.  
**Don’t**: build sentences in code or reuse one key for multiple meanings.

~~~json
// Do (locales/en/common.json)
{
  "welcome.title": "Welcome, {name}!"
}
~~~

~~~tsx
// Don’t
<h1>{"Welcome, " + name + "!"}</h1>
~~~

---

## 15.5 State & Data

**Do**: fetch in hooks/services; use Query keys and caching; keep UI-only state small.  
**Don’t**: fetch inside primitives or duplicate server data in random stores.

~~~ts
// Do
export function useStation(id: string) {
  return useQuery({ queryKey: qk.station.detail(id), queryFn: () => api.getStation(id) });
}

// Don’t
export function StationCard({ id }: { id: string }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(`/api/stations/${id}`).then(r => r.json()).then(setData); }, [id]);
  // ...
}
~~~

---

## 15.6 Performance

**Do**: code-split by route/feature; lazy-load heavy widgets; memo when profitable.  
**Don’t**: import heavy deps at entry or attach expensive listeners on scroll.

~~~tsx
// Do
const MapWidget = React.lazy(() => import("./MapWidget"));
<Suspense fallback={<Spinner />}><MapWidget /></Suspense>

// Don’t
import MapWidget from "./MapWidget"; // eager on the initial route
~~~

---

## 15.7 Accessibility

**Do**: native elements, keyboard support, visible focus, ARIA where needed.  
**Don’t**: clickable divs, hidden focus, color-only cues.

~~~tsx
// Do
<button onClick={onSave}>{t("actions.save")}</button>

// Don’t
<div onClick={onSave} role="button" tabIndex={0} />
~~~

---

## 15.8 Settings & Config

**Do**: read from JSON settings with schema validation; override per app.  
**Don’t**: hardcode links/flags in components.

~~~ts
// Do
const feedbackUrl = getSetting("routes.feedback");

// Don’t
const feedbackUrl = "https://example.com/feedback";
~~~

---

## 15.9 Packages & Imports

**Do**: import via **public** entrypoints; keep packages isomorphic unless named `*-node`.  
**Don’t**: deep import `dist/*` or import from apps inside packages.

~~~ts
// Do
import { translate } from "@shared-utils/i18n";

// Don’t
import { translate } from "@shared-utils/src/i18n/translate";
~~~

---

## 15.10 Testing

**Do**: test behavior via roles/names; mock network with MSW; keep tests fast.  
**Don’t**: assert on class names or implementation details; sleep with timeouts.

~~~tsx
// Do
const btn = screen.getByRole("button", { name: /save/i });
await user.click(btn);

// Don’t
const btn = container.querySelector(".primary-btn");
// Don’t
await new Promise(r => setTimeout(r, 2000));
~~~

---

## 15.11 Backend API

**Do**: validate inputs/outputs (Zod/JSON Schema), set ETag/Cache headers, stable error envelopes.  
**Don’t**: trust client, return raw DB errors, or leak stack traces.

~~~ts
// Do
if (!data) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Station not found" } });

// Don’t
return reply.code(404).send("nope");
~~~

---

## 15.12 Telemetry & Logging

**Do**: structured JSON, no PII, correlate with `requestId`.  
**Don’t**: log cookies/tokens/emails, or stringify entire request bodies.

~~~ts
// Do
req.log.error({ err, requestId: req.id, route: req.routerPath }, "unhandled_error");

// Don’t
console.error("User", userEmail, "did", action, "with token", token);
~~~

---

## 15.13 Git & Releases

**Do**: Conventional Commits, small PRs, Changesets for versioning.  
**Don’t**: “misc fixes” commits, merge broken CI, publish by hand.

~~~txt
// Do
feat(ui/button): add ghost variant

// Don’t
update stuff
~~~

---

## 15.14 UI Composition

**Do**: composition via children/slots and data-attrs; compound components with context.  
**Don’t**: extend components by inheritance or pass giant `renderEverything()` props.

~~~tsx
// Do
<TabsRoot value={tab} onChange={setTab}>
  <TabsRoot.List>
    <TabsRoot.Tab id="overview">Overview</TabsRoot.Tab>
  </TabsRoot.List>
  <TabsRoot.Panel id="overview">...</TabsRoot.Panel>
</TabsRoot>

// Don’t
class FancyTabs extends TabsRoot {} // inheritance
~~~

---

## 15.15 Error Handling

**Do**: show friendly UI, log details, and recover; use `Result` for expected failures.  
**Don’t**: swallow errors or crash the tree.

~~~ts
// Do
const res = await safeFetch();
if (!res.ok) return showToast(t("errors.retry"));

// Don’t
try { await doThing(); } catch {}
~~~

---

## 15.16 Routing & URL State

**Do**: reflect filters/sort in the URL; use a helper to sync params.  
**Don’t**: hide important state in global stores.

~~~ts
setParams({ q: "central", page: "2" }); // updates URL
~~~

---

## 15.17 Animations & Motion

**Do**: transform/opacity; honor `prefers-reduced-motion`.  
**Don’t**: animate expensive properties or force layouts.

~~~css
/* Do */
.modal { transform: translateY(0); opacity: 1; transition: transform .2s, opacity .2s; }

/* Don’t */
.modal { top: 100px; transition: top .2s; }
~~~

---

## 15.18 Security

**Do**: sanitize user HTML, set strict headers, validate all inputs.  
**Don’t**: `dangerouslySetInnerHTML` with untrusted strings or wildcard CORS.

~~~tsx
// Do
<SafeHtml html={userProvided} />

// Don’t
<div dangerouslySetInnerHTML={{ __html: userProvided }} />
~~~

---

## 15.19 Monorepo Hygiene

**Do**: run `typecheck`, `lint`, `test`, `build` before pushing (Husky).  
**Don’t**: bypass hooks/CI unless resolving an incident.

~~~bash
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
~~~

---

## 15.20 One-Liners to Remember

- **Types are contracts.**  
- **No hardcoded strings or colors.**  
- **Public entrypoints only.**  
- **URL reflects user state.**  
- **A11y is non-negotiable.**  
- **Budgets are real.**  
- **Consent before telemetry.**  
- **Small PRs, big impact.**

---

# 16) Decision Log (Template)

> **Goal:** Capture *why* we made non-obvious choices so agents and humans don’t re-litigate the same debates. Keep it lightweight by default; use a full ADR when impact is high.

## 16.1 Where & How

- **Quick log:** `docs/decisions.md` — single file with one-liners (date, what, why, link).
- **Full ADRs:** `docs/adr/NNN-short-title.md` — numbered, immutable records for big decisions.
- **When to log:** Any change to architecture, boundaries, tokens/themes, i18n strategy, build/release, security posture, or public APIs.

---

## 16.2 Quick Log Format (default)

Append an entry at the top of `docs/decisions.md`.

~~~md
- 2025-09-19 — Centralized config & locales with app overrides. **Why:** clarity + scale. **Refs:** #342, PR #351.
- 2025-09-19 — Enforce package public entrypoints only (no deep imports). **Why:** avoid cycles & churn. **Refs:** #339.
- 2025-09-20 — Add performance budgets per route (JS/CSS/LCP). **Why:** prevent regressions. **Refs:** PR #360.
~~~

Tips:
- Keep **one sentence of why**.
- Always add **Refs** (issues/PRs/links).

---

## 16.3 ADR Format (for high-impact decisions)

Create a new file: `docs/adr/NNN-short-title.md` (increment `NNN` with zero padding).

~~~md
# ADR NNN: Short, imperative title

**Status:** Accepted | Proposed | Deprecated | Superseded by ADR NNN  
**Date:** 2025-09-19  
**Owners:** @you, @teammate  
**Related:** Issues #123, PR #456

## Context
- What problem or pressure led to this?
- Constraints (e.g., monorepo, multiple apps, theming, i18n).
- Options considered.

## Decision
- The choice made (be precise).  
- Scope (what it applies to; what it *doesn’t*).

## Consequences
- Positive: …
- Negative / trade-offs: …
- Follow-ups / migrations required.

## Alternatives Considered
- Option A — Pros/Cons
- Option B — Pros/Cons
- “Do nothing”

## Implementation Notes
- Links to code, scripts, config (e.g., `config/themes/*.json`).
- Rollout plan, flags, deprecations.

## References
- Benchmarks, design docs, prior ADRs, external articles.
~~~

**Naming:** `NNN-kebab-title.md` (e.g., `001-theme-tokens-as-css-vars.md`).

---

## 16.4 Index & Linking

Keep an index in `docs/adr/README.md`:

~~~md
# ADR Index
- ADR 001 — Theme tokens as CSS variables (2025-09-19) — Status: Accepted
- ADR 002 — Enforce package public entrypoints (2025-09-19) — Status: Accepted
~~~

Link ADRs from:
- PR descriptions under **Context** / **Motivation**.
- Section headers in this AGENTS.md where relevant (e.g., §2.8 Import Boundaries).

---

## 16.5 Automation (optional but nice)

- `scripts/new-adr.ts` — prompts for title → creates numbered ADR from template.
- CI check: if files in `config/`, `locales/`, `packages/ui/`, or `turbo.json` change, require:
  - a quick-log line **or**
  - a new/updated ADR.
- PR label `needs-adr` auto-applied by GitHub Action when certain paths change.

~~~yaml
# .github/workflows/adr-check.yml (sketch)
name: adr-check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Require decision log or ADR for structural changes
        run: node scripts/check-adr.js
~~~

---

## 16.6 When to Use Quick Log vs ADR

- **Quick log** if:
  - Low/medium impact; easily reversible; clear owner.
  - No new public API; no migration required.

- **ADR** if:
  - Cross-cutting architectural choice (state strategy, theming model).
  - Public API/package changes; migration needed; security implications.
  - Decision likely to be revisited in the future.

---

## 16.7 Examples

**Quick Log (docs/decisions.md):**
~~~md
- 2025-09-21 — Move Button to @metro/ui and expose variants via data-attrs. **Why:** cross-app reuse. **Refs:** PR #374.
~~~

**ADR (docs/adr/003-i18n-icu-as-default.md):**
~~~md
# ADR 003: Use ICU message format for all user-facing strings
Status: Accepted
Date: 2025-09-21
Owners: @you
Related: Issues #210, PR #382

## Context
We support multiple languages and need plural/select formatting without concatenation.

## Decision
Adopt ICU messages in `/locales/<lang>/*.json`. Components must not build sentences via string concatenation; use placeholders.

## Consequences
+ Consistent pluralization and gender support.
− Slightly heavier runtime; need compile-time caching.

## Alternatives
- Simple templates — failed pluralization.
- Full i18n SaaS — vendor lock-in, not needed now.

## Implementation Notes
- Build-time key extraction + validation (scripts in `/scripts`).
- Translator wrapper in `@shared-utils/i18n`.
~~~

---

## 16.8 Agent Checklist (for decisions)

- Did your PR **change architecture, boundaries, or public APIs**?
- If yes, add a **quick-log** entry; if impact is high, open an **ADR**.
- Link the issue/PR and add owners.
- If superseding a decision, **deprecate** older ADR with a link.
- Update **§2.10** (Decision Log) summary if structure changed.

---
