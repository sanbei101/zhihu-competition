# 项目长期记忆 · zhihu-competition

## 产品方向

知乎黑客松参赛作品："如果…会怎样"世界线演变沙盘。

- 核心：反事实前提 + 多智能体自主演化 + 自然分叉 + 观测式交互
- 玩家是"打开开关后的观察者"，不是每回合改写世界的上帝
- 结算即内容：推演过程整理成知乎体长文

## 技术约定（来自 AGENTS.md，必须遵守）

- Next.js 16 App Router + React 19 + React Compiler，`standalone` 输出
- Tailwind CSS v4（`@tailwindcss/postcss`），主题变量在 `app/globals.css`
- **shadcn/ui 是唯一基础组件库**；尽可能直接复用已有组件，少写 className，**禁止原生 CSS**
- 严格 TS，避免 `any`；提交前跑 `pnpm fmt` + `pnpm lint`
- 包管理用 `pnpm`

## 像素视觉体系（可复用资产，勿轻易改动）

| 模块                                | 职责                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `components/pixel/pixel-sprite.tsx` | SVG 像素原语，`shapeRendering="crispEdges"`，多帧走 SMIL 逐帧 opacity        |
| `components/pixel/generators.ts`    | 程序化帧生成器（plant/peak/orb/helix/beacon/banner/relic/egg），纯函数无随机 |
| `components/pixel/sprites.ts`       | `spritesForSkin(skin)` 按主题返回 hero/prop/sky 三种 slot                    |
| `components/pixel/entity-emblem.ts` | **世界主体徽记**，11 种 EntityKind 各一个 16×16 造型                         |
| `components/pixel/theme-stage.tsx`  | `StageBackdrop`（天幕/星尘/远山/地台）+ `ThemeStage` 整屏演出                |
| `lib/scenario-skin.ts`              | 10 套皮肤 + `skinStyleVars()` 覆盖 shadcn 语义变量实现整体换肤               |

关键约定：

- `GROUND_BAND` 与 `GROUND_LINE` 必须成对出现，改一处要三处同步
- 像素色板语义：`o` 暗部轮廓 / `x` 主色 / `y` 高光 / `e` 点睛色
- 所有生成器必须纯函数、无随机，保证 SSR 与 CSR 渲染一致
- **人物立绘体系（`portraits.ts`）已随 v1 删除**，徽记体系是当前唯一的世界主体视觉

## 架构（v2 世界制，v1 角色议会制已彻底删除）

- `lib/scenario-library.ts`：**题库事实数据只读**，标题/链接不得编辑
- `lib/world-sim.ts`：世界模型全量类型（WorldSeed / WorldEntity / EraSnapshot / WorldFork / WorldBranch）
- `lib/scenario-profiles.ts`：10 主题 Profile（mode / timeScale / entityKinds / metricDefinitions）
- `lib/world-sim-events.ts`：zod 协议层（模型片段 / 流事件 discriminated union / 请求体）
- `lib/world-sim-engine.ts`：推演引擎，不关心传输方式
- `lib/world-sim-reducer.ts`：**确定性限制的唯一落点**（钳制 / 剪引用 / 展示预算 / 时间标签兜底）
- `lib/world-sim-storage.ts`：本地存档，key `world-sim:${id}`
- `lib/prompts/`：按调用阶段一文件一阶段，`index.ts` 只做具名再导出

## LLM 调用纪律（踩过坑，务必遵守）

1. **绝不让"形状/量纲写歪"枪毙一次调用。** 校验层只保证"这是个数字 / 这是个数组 / 这是个字符串"，
   数值范围与数组长度全部由 reducer 的 `DISPLAY` 预算确定性钳制。
   反面教材：`value` 上限 100 让整份种子作废；`actions` 上限 5 让一个主体整阶段等于没行动。
2. **提示词与兜底同时做。** 时间标签、指标量纲这类容易漂移的字段，提示词里说清写法，
   服务端再给确定性兜底（如 `movingTimeLabel`），不依赖模型自觉。
3. **输出预算给足。** 种子一次要吐 4-7 个主体×五项内容，`maxOutputTokens` 低于 8000 会截断成非法 JSON。
4. **种子一次调用生成全部主体**（保证目标不重叠、关系互为指向）；
   **只有主体推演阶段真并行**（`Promise.all`，彼此不可见，冲突由此自然产生）。
5. 部分主体失败不该终止整局：emit `entity-error`，裁决时按"它没行动"处理；全部失败才终止。

## 路由

- `/` 主题乐园首页｜`/world/[id]` 题库详情 + 主玩法入口｜`/world/[id]/sim` 世界线控制台
- API：`/api/world-seed`（NDJSON）｜`/api/world-simulate`（NDJSON）｜`/api/world-observations`（JSON）

## 用户偏好

- 重视"像素舞台式布局"的视觉连续性，改造不应丢失既有观感
- 要求先出可审核的 UI demo，再推进后端链路
- **明确要求删干净旧逻辑**，不做兼容层、不留过渡代码
- 不要用 playwright 做验证
