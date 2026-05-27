@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # start production server
npm run lint     # ESLint
npx tsc --noEmit # type-check without building
```

No test runner is configured yet.

## Architecture

Fresh Next.js 16 App Router project scaffolded with `create-next-app`. TypeScript, Tailwind CSS v4, and ESLint are configured.

- `src/app/` — App Router root. `layout.tsx` is the root layout; `page.tsx` is the home route.
- `src/` path alias `@/*` maps to `src/*`.
- Fonts: Geist Sans and Geist Mono loaded via `next/font/google`.
- Tailwind CSS v4 with PostCSS (`postcss.config.mjs`). Uses the new `@tailwindcss/postcss` plugin — no `tailwind.config` file.
- ESLint flat config (`eslint.config.mjs`) with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Next.js 16 Breaking Changes

This project runs **Next.js 16**, which has significant breaking changes from v14/v15 that likely differ from training data. Read `node_modules/next/dist/docs/` before writing code involving any of these areas:

**Async Request APIs** — `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are now async-only. No synchronous access:
```ts
// page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const searchParams = await props.searchParams
}
```
Run `npx next typegen` to generate `PageProps`, `LayoutProps`, `RouteContext` helpers.

**`middleware` → `proxy`** — The `middleware.ts` convention is deprecated. Use `proxy.ts` with a named `proxy` export. Edge runtime is not supported in `proxy`; use `middleware` if edge runtime is needed.

**Caching** — `revalidateTag` now requires a second `cacheLife` profile argument. Use `updateTag` in Server Actions for immediate expiration. Read `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` before implementing caching.

**Turbopack by default** — Both `next dev` and `next build` use Turbopack. Custom webpack configs will cause build failures. Use `--webpack` flag to opt out.

**ESLint flat config** — `next lint` command is removed; use `eslint` directly (already reflected in `package.json`).

**Scroll behavior** — Next.js no longer overrides `scroll-behavior: smooth` during navigation. Add `data-scroll-behavior="smooth"` to `<html>` if previous behavior is needed.

**Image defaults changed** — `minimumCacheTTL`, `imageSizes`, and `qualities` have new defaults. Check `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` if configuring `next/image`.

Full v16 upgrade guide: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
