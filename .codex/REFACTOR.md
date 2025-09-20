# How to make the agent refactor the app using AGENTS.md

## Preflight (once)
1. Commit **AGENTS.md** to repo root.
2. Create a long-lived branch: `refactor/agents-alignment`.
3. Ensure these scripts exist (or stub them):  
   - `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`, `pnpm -w build`, `pnpm -w validate:config`
4. Open **AGENTS.md** in a split and keep Preview on.

## One “orchestrator” prompt (pin this in the chat)
~~~txt
You are refactoring this monorepo to comply with AGENTS.md. Before each change:
- Read AGENTS.md §§1–2.8, 4–8, 9, 10, 14.
- Propose a small, reversible plan (≤ 200 LoC change) for the next phase only.
- Never break §2.8 import boundaries; no deep imports; no hardcoded strings/colors.
- After edits, run: pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build && pnpm -w validate:config
- If any step fails, stop and show the errors + diff. Do not proceed.
- Use Conventional Commit messages and small PR-sized commits.
I will paste commands and approve step by step.
~~~

## Phases (run in order)

### Phase 1 — Scaffold config/locales/themes
Prompt:
~~~txt
PHASE 1: Create folders/files per §2.4 and §5/§6:
- /config/schemas/{settings.schema.json,theme.schema.json,locale.schema.json}
- /config/settings/{defaults.json,features.json,routes.json}
- /config/themes/{light.json,dark.json}
- /locales/{en,pt}/{common.json,nav.json,errors.json}
Add minimal, valid JSON and a tiny runtime loader in @shared-utils:
- settings: deep-merge global + apps/<name>/app.config.json
- themes: flatten to CSS vars
- locales: merge global + app overrides
Wire providers in apps/frontend (theme + i18n). Don’t change UI yet. Show diff.
~~~

### Phase 2 — i18n extraction (replace hardcoded strings)
Prompt:
~~~txt
PHASE 2: Scan TS/TSX for visible text and aria labels per §6.1–§6.4.
- Extract user-facing strings to /locales/en/{common,nav,errors}.json with stable keys.
- Replace in code with t("<ns>.<key>").
- Do NOT extract non-UX strings (e.g., enum names, logs).
- Add a script: scripts/extract-i18n-keys.ts and run it.
Change ≤ 150 lines; start with the Home route only. Show diff + new JSON.
~~~
(Optional quick find you can run yourself:)
~~~bash
rg -n --hidden -g '!dist' -g '!node_modules' --glob '!**/*.test.*' -e '>([^<>{}]+)<|aria-(label|placeholder)="([^"]+)"'
~~~

### Phase 3 — Tokenize styling (no hardcoded colors)
Prompt:
~~~txt
PHASE 3: Replace hex colors and themeful inline styles with CSS vars per §5.4–§5.9.
- Map primary text/bg/border to tokens.
- Keep Tailwind; use arbitrary values with var(--token).
- No visual changes intended. Limit to components touched in Phase 2. Show diff.
~~~

### Phase 4 — Component extraction & folder anatomy
Prompt:
~~~txt
PHASE 4: For the Home route, split UI into primitives/feature components per §4.2–§4.5.
- Create src/components/<Name>/{Name.tsx,Name.types.ts,index.ts,Name.test.tsx}
- No data fetching in primitives. Accept className, data-attrs for variants.
- Add minimal tests (render, a11y). Show diff.
~~~

### Phase 5 — Move data fetching into hooks + query keys
Prompt:
~~~txt
PHASE 5: Per §7.4, introduce @tanstack/react-query hooks for Station domain:
- packages/shared-utils/query-keys.ts with qk.station.{list,detail}
- apps/frontend/src/features/stations/{api,hooks}/...
- Pages/components consume hooks only. No fetch in components.
- Add retry/staleTime defaults. Show diff + tests.
~~~

### Phase 6 — Import boundary enforcement
Prompt:
~~~txt
PHASE 6: Add ESLint rules from §2.8 and fix violations in changed files only.
- import/no-internal-modules forbid deep imports
- no-restricted-imports block apps/* from packages/*
- Add tsconfig path aliases if missing
Run lint autofix; for remaining violations, show proposed safe fix diffs.
~~~

### Phase 7 — A11y passes
Prompt:
~~~txt
PHASE 7: Apply §9 keyboard/ARIA rules to extracted components.
- Ensure roles, labels, focus management.
- Add a11y tests (Testing Library). Show diff.
~~~

### Phase 8 — Budgets & perf guardrails
Prompt:
~~~txt
PHASE 8: Add config/perf-budgets.json and hook bundlewatch/LHCI per §8.2/§8.12.
- Split any newly heavy widgets with React.lazy.
- Show budget file + CI workflow diff.
~~~

## Safety rails (repeat in every phase)
- No default exports for new modules; named exports only (§3.2).
- No `any`. If uncertain, use `unknown` + narrow.
- No strings or hex colors left in changed files (verify with rg).
- Update docs/decisions.md with a one-liner (§16.2).

## Commit style
Use Conventional Commits, e.g.:
- feat(i18n): extract home route strings to locales
- refactor(ui): split home into primitives and features
- chore(eslint): enforce public entrypoints only
