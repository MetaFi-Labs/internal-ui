# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router; co-locate route layouts and loading states per segment.
- Shared utilities (e.g. `lib/utils.ts` with the `cn` helper) belong in `lib/`; add reusable hooks or adapters here.
- Static assets live in `public/`; favor descriptive, hashed filenames for new media.
- Tailwind tokens and component presets are driven by `components.json`, `postcss.config.mjs`, and `tailwindcss` v4 defaults—update them together.
- Keep environment variables in `.env.local`; document required keys in the PR description.

## Build, Test, and Development Commands
- `npm run dev` (or `bun dev`) launches Turbopack at `http://localhost:3000`, reflecting edits under `app/` instantly.
- `npm run build` compiles the production bundle and performs type checks; run before opening a PR.
- `npm run start` serves the `.next/` output for smoke testing with production settings.
- `npm run lint` applies ESLint via `eslint.config.mjs`; pass it locally before pushing.

## Coding Style & Naming Conventions
- Stick to TypeScript everywhere (see `tsconfig.json`) and 2-space indentation as in `app/page.tsx`.
- React components are `PascalCase`, hooks/utilities `camelCase`, route folders lowercase with hyphens if needed.
- Tailwind classes should read layout → spacing → typography → state; prefer the `cn` helper for conditional classes.
- Formatting relies on ESLint; if you add Prettier, align rules and run it on staged files only.

## Testing Guidelines
- No automated tests ship yet; introduce `@testing-library/react` + `vitest` for unit coverage and co-locate specs as `*.test.tsx` beside the source.
- Target ≥80% line coverage and include regression cases for data loaders or API integrations.
- For interactive flows, add Playwright smoke tests in `app/__tests__/` against `npm run start` and document fixtures in README updates.

## Commit & Pull Request Guidelines
- Bootstrap commits follow imperative, type-prefixed messages (e.g. `chore: scaffold next app`); continue using Conventional Commits with subjects ≤72 chars.
- Reference issues in the body (`Refs #123`) and note breaking changes explicitly.
- PRs must summarize scope, list testing evidence (command output or screenshots), and attach UI captures when visuals change.
- Require at least one peer review; merge only after linting and planned tests succeed locally.
