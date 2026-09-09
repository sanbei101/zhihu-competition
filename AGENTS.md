# 项目简述

我打算做一个好玩的web端参赛作品参加`知乎`的黑客松,主题: 经典"脑洞/历史假设题"具象化 --'"如果...会怎样"世界线演变沙盘'

- 核心概念:以知乎最具代表性的"历史假设 / 科幻脑洞"高赞问题为母本(如"如果赤壁之战曹操赢了历史会怎样?""如果太阳熄灭前三天人类收到警告?"),打造策略向文字推演模拟器

- 游戏机制:
  1. 玩家扮演关键历史人物或决策者,面对突发事件进行抉择。
  2. AI Multi-Agent(多智能体)机制:多智能体分别扮演朝臣、异邦、平民等势力进行博弈演算,实时生成连锁反应与分支世界线。
  3. 结算即内容:通关后,AI 会将玩家的世界线推演过程自动整理成一篇格式严密的"知乎体深度长文回答",附带数据卡片,便于在社区内一键发帖分享。
  4. 知乎生态契合度:精准切入知乎硬核历史区、科幻区的"推演推拿"狂欢,把单向答题变成人人可玩的沙盘互动。

## 1. 项目概述与架构

本项目基于 **vinext** 构建,在 **Vite 8** 之上运行 Next.js App Router 规范,通过 **Rolldown/Oxc** 编译,并直接部署到 **Cloudflare Workers**。

- **框架**: `vinext`(基于 `Vite` 的 Next.js 16 App Router 兼容实现)
- **运行时**: Cloudflare Workers
- **UI 与 React**: React 19 + React Server Components (RSC)
- **自动记忆化**: 通过 `oxc-transform-react` 使用 React Compiler
- **样式方案**: Tailwind CSS v4,通过 `@tailwindcss/vite` 使用 `tailwindcss`, 配置文件在 `app/globals.css`
- **包管理器**: `pnpm`

---

### React 与 App Router 规范

- **默认服务端组件**:`app/` 目录下的文件默认为 React Server Components,除非标记了 `"use client"`。
- **客户端边界**:仅在需要状态、生命周期钩子(`useState`、`useEffect`)或浏览器 API 时使用 `"use client"`。
- **文件扩展名**:**始终使用 `.tsx`**
- **数据获取**:在 Server Components 中直接使用 async/await 或标准 Route Handlers 获取数据。

### Cloudflare Workers 绑定

- 在 Server Components、Server Actions 或 Route Handlers 中,通过以下方式原生访问 Cloudflare 绑定(KV、D1、R2、AI 等):
  ```tsx
  import { env } from "cloudflare:workers";
  ```

### 样式与 CSS

- Tailwind CSS v4 通过官方 Vite 插件(`@tailwindcss/vite`)使用。
- **不要**创建 `postcss.config.js` 或安装 `@tailwindcss/postcss`。
- 全局样式和自定义主题变量应放在 `app/globals.css` 中,使用 `@theme` 和 `@import "tailwindcss";` 指令。

### 工具链约束

- **仅限 Vite 插件**:本项目运行在 Vite 上,而非 Webpack 或 Turbopack。请勿建议安装 Webpack 加载器或 Next.js 专用 SWC 插件。
- **请勿手动注册 `@vitejs/plugin-rsc`**:`vinext` 内部已处理 RSC 插件的注册。

---

## 3. 代码质量与规范

- 保持严格的 TypeScript 类型定义。避免使用 `any`,类型断言。
- API 路由放在 `app/api/.../route.ts` 中,使用标准 Web API 对象(`Request`、`Response`、`NextRequest`、`NextResponse`)。
- 添加新依赖时,优先选择轻量、现代、ESM-first 且兼容边缘运行时的包(避免使用依赖 Node 原生 C++ 二进制模块的包,如 `sharp`)。
- 提交前应运行 `pnpm fmt` 和 `pnpm lint`

## 4. UI 组件标准 - shadcn/ui

尽可能直接使用 `shadcn` 中已有的组件, 少自己实现,可以使用 `shadcn mcp` 获取想要用的组件,

所有 UI 组件必须使用 `shadcn/ui` 作为基础组件库进行构建

```
npx shadcn@latest add <组件名称>
```

尽可能少写 `className`,不要写稀奇古怪的class,比如渐变阴影等复杂逻辑, **禁止**写原生css
