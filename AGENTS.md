# AGENTS.md - AI Coding Agent Guidelines

## 1. Project Overview & Architecture

This project is built with **vinext**, running Next.js App Router conventions on top of **Vite 8**, compiled via **Rolldown/Oxc**, and deployed directly to **Cloudflare Workers**.

- **Framework**: `vinext` (Next.js 16 App Router compatibility on Vite)
- **Runtime**: Cloudflare Workers (workerd)
- **UI & React**: React 19 + React Server Components (RSC)
- **Auto-Memoization**: React Compiler via `oxc-transform-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` (No PostCSS, no `tailwind.config.js`)
- **Package Manager**: `pnpm`

---

## 2. Key Architectural Rules for Agents

### React & App Router Conventions

- **Server Components by Default**: Files inside `app/` are React Server Components unless marked with `"use client"`.
- **Client Boundaries**: Only use `"use client"` when state, lifecycle hooks (`useState`, `useEffect`), or browser APIs are required.
- **File Extensions**: **Always use `.tsx`**
- **Data Fetching**: Fetch data directly in Server Components using async/await or standard Route Handlers.

### Cloudflare Workers Bindings

- Access Cloudflare bindings (KV, D1, R2, AI, etc.) natively in Server Components, Server Actions, or Route Handlers via:
  ```tsx
  import { env } from "cloudflare:workers";
  ```
- **Do not** use `getPlatformProxy()` or custom worker wrappers. Declare all bindings inside `wrangler.jsonc`.

### Styling & CSS

- Tailwind CSS v4 is used via the official Vite plugin (`@tailwindcss/vite`).
- **Do not** create `postcss.config.js` or install `@tailwindcss/postcss`.
- Global styles and custom theme tokens belong in `app/globals.css` using the `@theme` and `@import "tailwindcss";` directives.

### Toolchain Constraints

- **Vite Plugins Only**: This project runs on Vite, not Webpack or Turbopack. Do not suggest or install Webpack loaders or Next.js-specific SWC plugins.
- **Do not manually register `@vitejs/plugin-rsc`**: `vinext` handles RSC plugin registration internally.

---

## 3. Code Quality & Conventions

- Maintain strict TypeScript types. Avoid using `any`.
- Keep API routes inside `app/api/.../route.ts` using standard Web API objects (`Request`, `Response`, `NextRequest`, `NextResponse`).
- When adding new dependencies, prefer lightweight, modern ESM-first packages compatible with edge runtimes (avoid Node-native C++ binary modules like `sharp` where possible).
- should run `pnpm fmt` & `pnpm lint` before committing
