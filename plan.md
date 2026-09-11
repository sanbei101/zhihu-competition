# 知乎脑洞游乐园：自主世界线模拟器改造计划

> 文档状态：待实施
>
> 目标版本：World Simulation v2
>
> 核心方向：反事实前提 + 多智能体自主演化 + 自然分叉 + 观测式交互

## 1. 项目目标

### 1.1 产品定位

本项目不再以“玩家扮演一个人、和几个人对话”为核心玩法，而是改造成一个面向知乎脑洞题的文字世界模拟器。

玩家从题库中选择一个反事实前提，例如：

- 如果曹操赢了赤壁之战
- 如果太阳突然熄灭
- 如果恐龙没有灭绝
- 如果人类突然消失
- 如果 AI 已经觉醒

系统基于这个前提建立一个自洽的世界，然后让多个代表不同力量的 Agent 自主行动。玩家主要负责观察、推进时间、选择关注对象和追踪自然产生的世界线分叉。

### 1.2 目标体验

玩家的感受应该从：

```text
“我该怎么回答这个人？”
```

转变为：

```text
“这个条件一旦成立,世界会自己变成什么样？”
```

玩家不是每回合修改世界的上帝，而是打开一个反事实开关后的观察者和推演导演。

### 1.3 核心循环

```text
选择知乎脑洞题目
    ↓
提取反事实前提
    ↓
建立世界种子
    ↓
生成异质世界主体
    ↓
各主体自主行动
    ↓
推进一个时间阶段
    ↓
合并行动冲突并生成全球事件
    ↓
检测自然产生的分叉
    ↓
玩家选择继续观察哪条可能历史
    ↓
再次推进世界
```

### 1.4 第一版必须满足的体验标准

一次世界推进完成后，玩家至少应该看到：

- 两个以上世界主体发生变化
- 三条以上全球级事件或状态变化
- 一条跨主体因果链
- 一个可以解释的阶段性结论
- 在重大冲突时出现至少两个自然分叉

如果一次推进的主要结果仍然是四个人的对话，就说明没有完成玩法迁移。

## 2. 现状与问题

### 2.1 当前代码结构

当前系统的主链路如下：

```text
scenario-library.ts
    ↓
WorldCastPanel
    ↓
/api/world-cast
    ↓
3 个玩家角色 + 4 个 Agent 角色
    ↓
/world/[id]/council
    ↓
玩家选择一个决策选项
    ↓
/api/world-turn
    ↓
Agent 首轮回应 + Agent 交锋
    ↓
judgeTurnAction
    ↓
四维指标、危机、关系和回合记录
```

主要相关文件：

- `lib/scenario-library.ts`：知乎题库、主题、皮肤线索
- `lib/world-cast.ts`：世界背景和角色阵容 Schema
- `app/api/world-cast/route.ts`：分阶段生成角色
- `lib/world-options.ts`：当前四个决策选项
- `app/world/actions/options.ts`：当前选项生成 Action
- `app/api/world-turn/route.ts`：Agent 流式回应和交锋
- `app/world/actions/judge.ts`：回合裁决和指标结算
- `lib/world-ending.ts`：指标、关系、危机、回合和终局 Schema
- `components/world-council/index.tsx`：当前沙盘页面状态和总布局
- `components/world-council/decision-panel.tsx`：玩家决策面板
- `components/world-council/speech-stage.tsx`：角色舞台演出
- `components/world-council/timeline.tsx`：消息记录
- `components/world-council/branch-timeline.tsx`：当前已经加入的分支展示原型
- `components/world-council/world-tabs.tsx`：世界、关系、进程内部页签
- `components/world-council/turn-stream.ts`：回合 NDJSON 消费
- `components/world-finale.tsx`：当前角色第一人称终章

### 2.2 当前系统的根本问题

1. `WorldCast` 固定生成七个具体人物，无法表达生态系统、市场、气候或文明。
2. 玩家每回合面对的是角色式决策，而不是世界级反事实变化。
3. Agent 的主要输出是 `speech`，世界级变化只是裁决后的附属结果。
4. 四维指标主要表现一个小型政权或议事群体，没有足够的全球尺度。
5. 当前分支时间线保存了选择的分支标题，但过去未选择选项保存不足，无法形成真正的候选历史树。
6. 题库覆盖历史、末日、天体、演化、未来科技和外星接触，不能用同一套“朝堂 + 五个文明”模板。
7. 当前世界页面需要选择一个玩家角色，这与“玩家观察整个世界”的身份冲突。
8. 当前终章是角色第一人称自述，不适合上帝视角或世界史式结算。

## 3. 设计原则

### 3.1 反事实前提是唯一的初始改动

题目本身负责提出世界偏离点：

```text
如果 X 发生了
```

系统负责回答：

```text
之后哪些主体会先行动
哪些主体会获益
哪些系统会失效
哪些变化会跨领域扩散
几十年后会形成什么文明结构
```

第一版不允许玩家每回合自由修改物理规则、历史事件或文明属性。

### 3.2 Agent 是世界主体，不是聊天角色

Agent 的主要输出必须是：

- 目标
- 行动
- 资源变化
- 对其他主体的影响
- 事件
- 下一阶段计划

`speech` 或引用最多作为报告中的一小段氛围文字，不再是主界面主体。

### 3.3 多智能体必须有独立目标

不同 Agent 应该基于相同世界状态独立判断，而不是共享一个导演结论后换几个名字输出。

每个 Agent 必须有：

- 自己的目标
- 自己的能力
- 自己的限制
- 自己的资源
- 自己的判断误差
- 自己对其他主体的关系

### 3.4 LLM 负责推演，服务端负责世界状态

模型可以提出行动和事件，但不能直接决定最终数值。

服务端负责：

- 校验主体 ID
- 校验世界硬规则
- 限制数值变化范围
- 合并同类行动
- 处理冲突
- 推进时间
- 保存不可变快照
- 防止模型无条件创造奇迹

### 3.5 先保证跨尺度兼容，再增加复杂度

题库里的“太阳熄灭”和“曹操赢赤壁”不应该拥有相同的 Agent 类型、时间单位和指标名称。

统一的是模拟协议，不是所有世界的内容模板。

## 4. 题库兼容方案

### 4.1 不修改题库事实数据

`lib/scenario-library.ts` 中的以下字段视为产品内容，不在这次改造中修改：

- `ScenarioTopic.id`
- `ScenarioTopic.title`
- `ScenarioTopic.url`
- `ScenarioTopic.votes`
- `ScenarioTopic.comments`
- `ScenarioTopic.author`
- `ScenarioTheme.id`
- `ScenarioTheme.name`
- `ScenarioTheme.visual`

题目 ID 继续作为世界线 ID。

### 4.2 现有输入缺口

当前 `app/world/[id]/page.tsx` 传给 `WorldCastPanel` 的内容是：

```ts
{
  id: topic.id,
  title: topic.title,
  content: "",
  url: topic.url,
}
```

题库没有真正的文章正文，因此新世界生成不能把 `content` 当作主要事实来源。

新的请求输入必须增加：

```text
themeId
themeName
themeVisual
themeHint
topicTitle
topicUrl
```

其中：

- 题目标题是反事实前提的最高优先级来源
- 主题 ID 决定默认模拟类型
- 主题提示用于生成主体和氛围
- 视觉字段只影响像素皮肤，不影响事实推演
- 知乎链接、赞数、评论数只用于展示来源，不进入因果模拟

### 4.3 Scenario Profile

新增文件：

```text
lib/scenario-profiles.ts
```

Profile 不保存题目正文，只保存模拟器如何处理题目。

建议接口：

```ts
type SimulationMode =
  | "historical-civilization"
  | "ecological-evolution"
  | "survival-collapse"
  | "planetary-disaster"
  | "post-human"
  | "socio-technical"
  | "first-contact";

interface ScenarioProfile {
  mode: SimulationMode;
  defaultTimeScale: TimeScale;
  entityKinds: EntityKind[];
  interventionKinds: InterventionKind[];
  metricDefinitions: MetricDefinition[];
  minEntityCount: number;
  maxEntityCount: number;
  horizonHint: string;
}
```

### 4.4 主题配置

#### `dino`

默认模式：`ecological-evolution`

主体：

- 恐龙或其他非人类物种
- 人类社会
- 生态系统
- 科研机构
- 军事或产业系统

题型适配：

- “恐龙没有灭绝”：跨越生态、演化和文明形成
- “霸王龙复活”：现代生物事件和社会应对
- “五十斤兽脚类存活”：人类社会与单一物种的长期共存
- “恐龙发展出文明”：非人类智慧和文明竞争

时间尺度：根据标题在天、年、千年和百万年之间切换，不允许每回合固定推进相同时间。

#### `three-kingdoms`

默认模式：`historical-civilization`

主体：

- 魏或曹魏政权
- 蜀汉政权
- 江东政权
- 地方豪强和军镇
- 商贸与粮运网络
- 平民社会

时间尺度：月、年和十年。

重点模拟：制度扩张、人口、征税、军队、地方自治、外交和文化整合。

#### `qin-han`

默认模式：`historical-civilization`

主体：

- 中央政权
- 郡县官僚体系
- 贵族和地方势力
- 军队与边疆集团
- 农民和城市人口

重点模拟：郡县与分封、继承、法律、财政、中央集权和地方反弹。

#### `tang-song-ming`

默认模式：`historical-civilization`

主体：

- 中央朝廷
- 地方军镇
- 商贸网络
- 边疆政权
- 民间社会
- 技术和文书官僚体系

重点模拟：制度转型、边疆、财政、航海、殖民、改革和国家合法性。

#### `apocalypse`

默认模式：`survival-collapse`

主体：

- 国家政府
- 城市网络
- 医疗与科研系统
- 物流与能源系统
- 地方社区
- 生态系统

时间尺度：灾难初期使用小时、天和周，稳定后切换到月和年。

重点模拟：资源分配、迁徙、公共秩序、基础设施、疾病和社会协作。

#### `cosmic`

默认模式：`planetary-disaster`

主体：

- 行星物理系统
- 气候系统
- 生物圈
- 国家集团
- 科研体系
- 基础设施网络

重点模拟：物理约束、环境变化、能源、粮食、人口和文明适应。

模型不能只输出人类政治反应，必须将自然系统作为独立主体或确定性过程。

#### `after-human`

默认模式：`post-human`

主体：

- 大型动物种群
- 鸟类和昆虫
- 植物与生态系统
- 城市基础设施
- 微生物和病原体
- 新兴智慧物种

不能默认生成政府、军队和人类角色。

重点模拟：基础设施衰败、生态位重组、物种竞争和新文明出现。

#### `evolution`

默认模式：`ecological-evolution` 或 `socio-technical`

主体根据标题变化：

- 人类社会
- 获得智慧的动物
- 食品和产业系统
- 法律与伦理体系
- 科研机构
- 民间社会

重点模拟：法律主体、生产关系、身份冲突、消费伦理和社会制度变化。

#### `future-tech`

默认模式：`socio-technical`

主体：

- 政府
- 科技企业
- AI 或自动化系统
- 劳动者
- 资本与市场
- 普通公众

重点模拟：技术扩散、就业、财富分配、监管、身份和社会结构。

#### `alien`

默认模式：`first-contact`

主体：

- 人类政府集团
- 军事系统
- 科学共同体
- 公众社会
- 外星文明
- 其他地外势力或代理组织

重点模拟：信号、误判、外交、军备、技术交换、社会分裂和文明尺度差异。

### 4.5 标题级子模式

主题 Profile 只决定大方向，世界种子生成器还要根据标题识别：

- 反事实发生的时间
- 事件影响的初始范围
- 时间推进速度
- 适合出现的主体类型
- 是否存在人类主体
- 是否存在可观测的物理硬约束
- 是否允许出现新的智慧主体

标题级分类可以先由确定性规则提供初始提示，再由世界种子 Agent 补全，不需要第一版建立复杂的 NLP 分类器。

## 5. 新世界数据模型

### 5.1 WorldSeed

建议新增 `lib/world-sim.ts`。

```ts
interface WorldSeed {
  scenarioId: string;
  scenarioTitle: string;
  themeId: string;
  simulationMode: SimulationMode;
  premise: CounterfactualPremise;
  startTime: TimeState;
  timeScale: TimeScale;
  hardRules: HardRule[];
  entities: WorldEntity[];
  globalMetrics: GlobalMetric[];
  initialEvents: WorldEvent[];
}
```

### 5.2 CounterfactualPremise

```ts
interface CounterfactualPremise {
  statement: string;
  divergencePoint: string;
  affectedDomains: string[];
  certainty: "given";
}
```

`statement` 必须忠实表达知乎题目，不允许被模型改写成完全不同的问题。

### 5.3 WorldEntity

```ts
type EntityKind =
  | "state"
  | "faction"
  | "population"
  | "ecosystem"
  | "species"
  | "company"
  | "institution"
  | "technology"
  | "ai"
  | "alien"
  | "planetary-system";

interface WorldEntity {
  id: string;
  name: string;
  kind: EntityKind;
  description: string;
  goals: string[];
  capabilities: string[];
  constraints: string[];
  metrics: EntityMetric[];
  relations: EntityRelation[];
  pixelArchetype: string;
}
```

`WorldEntity` 是旧 `agentCharacter` 的替代物。它不需要 `voice`、`openingLine`、`redLine` 等舞台对话字段。

### 5.4 GlobalMetric

不同主题的指标标签不同，但使用统一结构：

```ts
interface GlobalMetric {
  id: string;
  label: string;
  value: number;
  description: string;
  goodDirection: "up" | "down" | "mixed";
}
```

可复用的指标 ID：

- `population`
- `stability`
- `resources`
- `technology`
- `cohesion`
- `environment`
- `conflict`
- `knowledge`

不同 Profile 选择其中 4 到 6 个，并提供主题化标签。

例如：

```text
历史题：政权稳定、人口、资源、技术、社会整合
末日题：存活人口、能源、秩序、医疗、环境
天体题：生物圈、气候、基础设施、人口、知识
人类消失：生态恢复、物种多样性、基础设施、智慧演化
```

不建议使用完全动态的任意指标 ID 作为第一版唯一数据结构，否则 UI 和服务端限制会失去类型约束。

### 5.5 DivineObservation

第一版将玩家操作命名为“观测操作”，避免暗示玩家拥有全能改造能力：

```ts
type ObservationAction =
  | "advance-era"
  | "follow-entity"
  | "inspect-event"
  | "choose-fork";
```

玩家可以：

- 推进到下一个时间阶段
- 追踪某个主体
- 查看一条因果链
- 在自然分叉出现时选择继续观察的分支

第一版不提供自由文本神谕或每回合改写世界规则。

### 5.6 CivilizationReport

```ts
interface EntitySimulationReport {
  entityId: string;
  intent: string;
  actions: EntityAction[];
  stateChanges: ProposedStateChange[];
  events: ProposedWorldEvent[];
  relationChanges: ProposedRelationChange[];
  reasoningSummary: string;
}
```

Agent 只能提交 `ProposedStateChange`，不能直接改变 `WorldState`。

### 5.7 EraSnapshot

```ts
interface EraSnapshot {
  id: string;
  parentSnapshotId: string | null;
  branchId: string;
  timeBefore: TimeState;
  timeAfter: TimeState;
  stateBefore: WorldState;
  reports: EntitySimulationReport[];
  events: WorldEvent[];
  causalChains: CausalChain[];
  forks: WorldFork[];
  stateAfter: WorldState;
}
```

快照必须是不可变记录。当前世界状态只是主线指针，不允许覆盖过去的快照。

### 5.8 WorldFork

```ts
interface WorldFork {
  id: string;
  snapshotId: string;
  triggerEventId: string;
  title: string;
  cause: string;
  alternatives: WorldForkAlternative[];
  selectedAlternativeId: string | null;
}

interface WorldForkAlternative {
  id: string;
  title: string;
  premise: string;
  drivers: string[];
  expectedEffects: string[];
  plausibility: "low" | "medium" | "high";
}
```

第一版的分叉可以只对自然冲突产生的候选未来进行描述。后续再支持从过去快照真正恢复并重新模拟。

## 6. 多智能体模拟协议

### 6.1 世界种子生成

输入：

```text
题目标题
主题信息
Scenario Profile
题库皮肤
```

输出：

- 反事实前提
- 起始时间
- 3 到 6 条硬规则
- 4 到 7 个世界主体
- 初始指标
- 初始事件

世界种子生成阶段不生成玩家角色，不生成 Agent 台词。

### 6.2 观测选项生成

系统在每个阶段生成 3 到 4 个玩家可观察方向：

```text
[推进十年]
[追踪中央帝国]
[调查技术扩散]
[查看民众迁徙]
```

这些选项不改变世界状态，只决定模拟推进幅度或信息重点。

在有自然分叉时，额外显示：

```text
[继续观察中央集权路线]
[继续观察地方自治路线]
```

### 6.3 Agent 并行模拟

每个世界主体收到相同的：

- 当前世界状态
- 反事实前提
- 硬规则
- 其他主体的公开状态
- 当前阶段时间
- 玩家当前观测方向

每个 Agent 只生成自己的行动报告。

调用方式：

```text
Promise.all(entityAgents.map(simulateEntity))
```

第一版建议每个阶段使用 4 到 6 个主体 Agent，不要一开始拆成几十个微型 Agent。

### 6.4 世界裁决

世界裁决器接收所有主体报告，并执行：

1. 检查主体 ID 是否属于当前世界
2. 检查行动是否违反硬规则
3. 合并相同目标的行动
4. 检测相互冲突的行动
5. 计算主体状态变化
6. 计算全球指标变化
7. 生成公开事件
8. 生成因果链
9. 检测自然分叉
10. 推进时间
11. 输出新的不可变快照

### 6.5 确定性限制

服务端必须限制：

- 单阶段指标变化上限
- 单主体人口或实力增长上限
- 技术不能跨越硬规则瞬间出现
- 一个 Agent 不能单独决定全球结果
- 事件必须有至少一个主体和一个来源
- 新主体必须经过明确的生成理由
- 不能因为玩家选择了某个观测方向就自动判定好结局

## 7. API 设计

### 7.1 世界种子 API

建议新增：

```text
POST /api/world-seed
```

输入：

```ts
{
  scenarioId: string;
  title: string;
  themeId: string;
  themeName: string;
  themeVisual: string;
  themeHint: string;
  url: string;
}
```

流事件：

```text
seed-start
setting
entity-start
entity
complete
error
```

可以暂时复用 `/api/world-cast` 的路由名称，但不建议继续使用 `cast` 语义。新链路稳定后应迁移到 `/api/world-seed`。

### 7.2 观测选项 API

建议新增：

```text
POST /api/world-observations
```

输入：

```ts
{
  worldState: WorldState;
  history: EraSnapshot[];
  focusEntityId?: string;
}
```

输出：

```ts
{
  options: ObservationOption[];
}
```

这一步不是玩家改造世界，只是生成下一步观察和推进选项。

### 7.3 世界模拟 API

建议新增：

```text
POST /api/world-simulate
```

输入：

```ts
{
  seed: WorldSeed;
  state: WorldState;
  observation: ObservationOption;
  history: EraSnapshot[];
}
```

NDJSON 流事件：

```text
simulation-start
time-advance
entity-start
entity-report
world-event
causal-chain
fork-detected
snapshot
complete
error
```

### 7.4 Action 层

新增：

```text
app/world/actions/seed.ts
app/world/actions/observations.ts
app/world/actions/simulate.ts
```

`simulate.ts` 应作为服务端边界，负责输入 Schema、LLM 调用、状态合并和错误包装。

### 7.5 不建议的 API 方案

不建议让浏览器直接保存或提交未校验的文明状态作为下一回合事实来源。

客户端只提交：

- 当前存档 ID
- 观测选项 ID
- 当前分支 ID
- 可选关注主体 ID

服务端或客户端本地会话中的完整状态需要经过 Schema 校验后才能进入下一回合。

## 8. 前端信息架构

### 8.1 页面主身份

当前 `危机议事` 页面应改成类似：

```text
世界线控制台
```

标题区域显示：

- 题目标题
- 当前纪元或时间
- 模拟模式
- 世界稳定度
- 当前主体数量
- 当前分支编号

### 8.2 顶层 Tabs

第一版建议使用四个 Tab：

1. `世界控制台`
2. `时代报告`
3. `世界线`
4. `主体档案`

#### 世界控制台

首屏核心界面：

```text
当前时间与全局指标
当前阶段摘要
正在变化的世界主体
玩家观测操作
推进时间按钮
```

#### 时代报告

显示当前阶段的 Agent 模拟结果：

```text
世界推进了 18 年

中央帝国完成征税改革
海上商路绕开旧港口
沿海人口增加 21%
北方联盟开始统一

连锁后果：
贸易改道 → 城市扩张 → 粮价上涨 → 地方自治运动
```

这不是聊天气泡，而是结构化历史报告。

#### 世界线

显示：

- 当前主线
- 历史阶段节点
- 每次自然分叉的原因
- 未选择的候选未来
- 当前正在追踪的分支

#### 主体档案

每个主体显示：

- 像素徽记
- 类型
- 目标
- 主要资源
- 当前状态
- 最近行动
- 与其他主体的关系摘要

### 8.3 像素视觉系统

像素不再主要服务于人物立绘，而服务于世界状态：

- 每种主体有独立像素徽记
- 事件使用像素警报图标
- 技术扩散使用像素节点亮起
- 人口变化使用像素人群或数字滚动
- 时代推进使用像素翻页或时间带动画
- 世界崩溃使用断线、闪烁和状态色

现有 `ScenarioSkin` 继续负责主题视觉，但同一个组件必须能够显示不同类型的主体。

### 8.4 交互边界

第一版玩家只需要理解三个动作：

```text
推进
追踪
选择分叉
```

不要在第一版加入：

- 自由输入世界修改命令
- 多层资源配置
- 复杂科技树
- 角色私密目标
- 多个需要同时确认的弹窗

## 9. 分支系统设计

### 9.1 自然分叉的触发条件

当出现以下情况之一时，生成世界分叉：

- 两个主体的核心目标直接冲突
- 某项技术或制度达到扩散阈值
- 全球指标进入关键区间
- 一个主体解体、分裂或吞并另一个主体
- 关键危机存在两种以上稳定解法
- 一个事件改变了多个主体的长期目标

### 9.2 分叉内容

每条分叉必须回答：

- 分叉由什么事件触发
- 哪些主体推动了它
- 每条路线的主要方向是什么
- 哪些主体会受益
- 哪些主体会受损
- 未来几个阶段最可能看到什么

不能只生成：

```text
A 线更好
B 线更危险
```

应该生成：

```text
A · 中央集权路线
中央帝国获得短期稳定,地方军镇被削弱。
主要驱动：财政集中、军粮统一、边疆压力。

B · 地方联盟路线
中央失去部分税收,但边疆获得更高自治能力。
主要驱动：地方拒绝缴税、商路改道、军镇结盟。
```

### 9.3 第一版分叉实现

第一版只做：

- 保存所有自然分叉
- 保存玩家选择的路线
- 在世界线 Tab 中显示未选路线
- 让后续报告引用当前分支

第一版暂不做从任意过去节点恢复并重新运行完整世界。

### 9.4 第二版分叉回溯

后续再实现：

- 每个快照保存 `parentSnapshotId`
- 选择过去未选路线时恢复 `stateBefore`
- 创建新的 `branchId`
- 重新运行该节点之后的世界
- 支持两个分支的指标和事件对比

## 10. 题型示例

### 10.1 “如果曹操赢了赤壁”

初始前提：曹魏在赤壁取得决定性胜利。

主体：

- 曹魏中央政权
- 江东地方集团
- 蜀地残余势力
- 北方军镇
- 士族官僚
- 普通民众

自然演化：

```text
曹魏控制长江 → 江东转入地方抵抗
地方抵抗 → 财政和军粮压力上升
军粮压力 → 中央与地方军镇关系恶化
关系恶化 → 出现中央集权和地方割据两条分叉
```

玩家不决定“是否攻打江东”，而是观察曹魏赢下赤壁之后各方如何自主反应。

### 10.2 “如果太阳突然熄灭”

主体：

- 气候和光照系统
- 各国政府
- 农业和能源系统
- 科研体系
- 城市网络
- 普通民众

时间推进：

```text
第一阶段：小时和天
第二阶段：周和月
第三阶段：年
```

自然演化重点：能源、粮食、迁徙、秩序、地下设施和生态崩溃。

### 10.3 “如果霸王龙复活”

主体：

- 复活的恐龙种群
- 生物科技机构
- 政府和军方
- 当地居民
- 生态系统
- 全球媒体和公众

自然分叉：

- 秘密军事化
- 全球保护运动
- 生态隔离与长期共存

### 10.4 “如果人类消失”

主体不能包括人类政府或人类军队。

主体：

- 城市生态
- 大型哺乳动物
- 鸟类和昆虫
- 植物群落
- 海洋生态
- 新兴智慧物种

重点是基础设施逐渐失效和生态位重新分配。

### 10.5 “如果 AI 已经觉醒”

主体：

- AI 网络
- 科技公司
- 政府监管体系
- 劳动者
- 公众社会
- 其他自动化系统

重点是信息扩散、伪装、依赖、监管和社会结构变化，而不是某个 AI 角色和玩家聊天。

## 11. 终章改造

### 11.1 叙事视角

当前终章是角色第一人称自述：

```text
我是李泌,这件事发生在……
```

新终章改为世界史或史官报告：

```text
公元 732 年,世界线第一次偏离原有历史。
中央帝国获得蒸汽动力后,海上文明首先感受到变化。
```

### 11.2 终章输入

终章生成器需要接收：

- 反事实前提
- 世界种子
- 所有时代快照
- 当前主线
- 所有关键分叉
- 文明或主体的最终状态
- 全球指标变化
- 因果链
- 终局事件

### 11.3 终章内容

建议输出：

- 世界线标题
- 反事实起点
- 关键时代节点
- 各主体命运
- 技术和制度扩散
- 最大的连锁后果
- 当前世界格局
- 未选择路线的简短对照
- 知乎风格的总结回答

不再依赖 `player.privateGoal`，也不再要求全文第一人称。

## 12. 文件迁移计划

### 12.1 新增文件

```text
lib/scenario-profiles.ts
lib/world-sim.ts
lib/world-sim-prompts.ts
lib/world-sim-events.ts
lib/world-sim-reducer.ts

app/world/actions/seed.ts
app/world/actions/observations.ts
app/world/actions/simulate.ts

app/api/world-seed/route.ts
app/api/world-observations/route.ts
app/api/world-simulate/route.ts

components/world-simulator/index.tsx
components/world-simulator/world-console.tsx
components/world-simulator/entity-panel.tsx
components/world-simulator/observation-panel.tsx
components/world-simulator/simulation-feed.tsx
components/world-simulator/world-history.tsx
components/world-simulator/world-fork.tsx
components/world-simulator/world-tabs.tsx
```

### 12.2 迁移文件

#### `components/world-cast.tsx`

改名或替换为 `WorldSeedPanel`：

- 去掉玩家角色选择
- 去掉七个角色生成进度
- 改成世界种子和主体生成进度
- 传入完整 `ScenarioTheme` 信息
- 生成完成后直接进入世界控制台

#### `lib/world-cast.ts`

第一阶段可以保留旧 Schema 供旧页面使用，新的 `WorldSeed` 使用独立 Schema。

新系统稳定后删除旧角色专用字段。

#### `lib/world-options.ts`

不再作为人物决策选项 Schema 的核心来源，迁移为观测选项或保留为兼容层。

#### `app/api/world-turn/route.ts`

不立即删除，先作为旧流程使用。

新流程使用 `world-simulate`，避免新旧事件协议混用。

#### `app/world/actions/judge.ts`

拆成：

- 状态合并器
- 事件裁决器
- 结局判断器

名称建议改为 `simulate.ts` 或 `resolve-world.ts`。

#### `components/world-council/*`

保留到新页面完成后再删除：

- `speech-stage.tsx`：第一版不再使用
- `seats-panel.tsx`：改为主体档案后再删除
- `decision-panel.tsx`：改为观测面板后再删除
- `timeline.tsx`：改为时代报告后再删除
- `branch-timeline.tsx`：可以迁移为 `world-history.tsx`
- `world-tabs.tsx`：拆分为新世界控制台内部组件

### 12.3 路由策略

推荐继续使用：

```text
/world/[id]/council
```

因为它已经是用户进入沙盘的固定地址。内部组件替换为 `WorldSimulator` 即可，不需要为了改玩法新增公开路由。

## 13. 存档策略

### 13.1 新存档 Key

旧存档：

```text
world-council:${scenarioId}
```

新存档：

```text
world-sim:${scenarioId}
```

### 13.2 新会话结构

```ts
interface WorldSimulationSession {
  version: 2;
  scenarioId: string;
  scenarioTitle: string;
  themeId: string;
  seed: WorldSeed;
  currentState: WorldState;
  activeBranchId: string;
  snapshots: EraSnapshot[];
  focusEntityId: string | null;
  status: "ongoing" | "ended";
  ending: WorldEnding | null;
}
```

### 13.3 旧存档处理

不建议把旧的角色议事数据硬转换成文明模拟数据，因为两种存档的语义不同。

检测到旧存档时：

```text
发现旧版议事存档
→ 提示世界模拟器已升级
→ 保留旧存档不删除
→ 允许重新建立世界种子
```

### 13.4 存档大小控制

由于每个快照可能包含多个主体和报告，需要控制：

- `snapshots` 默认最多保存 20 个阶段
- 报告正文限制长度
- 只保留关键事件的完整文本
- 未选分支只保留结构化摘要
- 终章生成后可以压缩旧报告

## 14. 分阶段实施

### Phase 0：冻结旧链路并建立新契约

目标：不改变用户现有流程，只完成新类型设计。

任务：

- 新建 `lib/scenario-profiles.ts`
- 定义 10 个主题的 Profile
- 新建 `lib/world-sim.ts`
- 定义 `WorldSeed`、`WorldEntity`、`WorldState`、`EraSnapshot`
- 定义 Schema 和 TypeScript 类型
- 统一世界事件结构
- 增加 `version: 2` 存档类型

验收：

- 10 个主题都能得到合法 Profile
- 每个 Profile 都有主体类型、时间尺度和指标定义
- 旧代码仍然可以 typecheck

### Phase 1：世界种子生成

目标：从“角色阵容”变成“世界主体阵容”。

任务：

- 修改世界页面，把完整主题信息传给生成面板
- 新建 `/api/world-seed`
- 生成反事实前提
- 生成硬规则
- 生成 4 到 7 个主体
- 生成初始指标和初始事件
- 去掉角色选择环节
- 直接建立新的模拟会话

验收：

- 三国题不会生成现代企业和气候主体
- 人类消失题不会生成人类政府
- 太阳熄灭题会生成物理、气候、能源和人类系统
- 霸王龙复活题会生成物种、科研、政府和生态主体

### Phase 2：单回合自主模拟

目标：完成一次完整的“主体自主行动 → 世界推进”。

任务：

- 新建实体 Agent Prompt
- 并行生成 4 到 6 个主体报告
- 新建状态合并器
- 新建服务端约束检查
- 生成全球事件
- 生成因果链
- 输出新的 `EraSnapshot`
- 接入 NDJSON 流事件

验收：

- 主体报告没有角色式长篇对话
- 至少两个主体产生变化
- 服务端能拒绝违反硬规则的变化
- LLM 失败时可以显示局部错误并支持重试

### Phase 3：世界控制台 UI

目标：把当前议事厅替换成宏观控制台。

任务：

- 新建 `WorldSimulator`
- 新建世界控制台
- 新建主体档案
- 新建时代报告
- 新建观测操作面板
- 使用像素徽记表示主体
- 保留主题皮肤
- 删除主界面的角色对话依赖

验收：

- 首屏展示全球状态，而非四个人
- 玩家能明确看到当前时间和世界规模
- 世界推进过程中能看到主体报告流
- 桌面端和移动端不发生横向溢出

### Phase 4：自然分叉

目标：让世界线不再是一条单调的线。

任务：

- 增加分叉检测
- 保存未选择的候选未来
- 新建世界线 Tab
- 显示分叉触发原因
- 显示每条分支的驱动因素和预期后果
- 当前主线持续引用已选择分支

验收：

- 至少一个重大冲突会生成两个以上候选路线
- 未选路线不消失
- 世界线 UI 能看出分叉而不是普通列表
- 没有重大冲突时不会人为生成分叉

### Phase 5：题型和时间尺度校准

目标：让所有题库主题都能使用正确的模拟单位。

任务：

- 为每个主题准备固定测试题
- 调整时间推进规则
- 调整 Agent 类型
- 调整指标标签
- 调整结束条件
- 增加题型专属事件模板

验收：

- 10 个主题至少各跑通 3 个阶段
- 没有明显时代错位
- 物理题不会完全变成政治聊天
- 演化题不会强行套用政权指标

### Phase 6：终章和分享

目标：生成真正的知乎风格世界史报告。

任务：

- 改写终章 Prompt
- 从主体视角改为史官视角
- 接入快照、分叉和因果链
- 展示主体最终命运
- 生成未选分支对照
- 保留知乎分享文本

验收：

- 终章不出现“玩家”“AI”“Agent”“选项”等内部术语
- 文章能引用真实发生过的事件
- 文章覆盖多个主体，而非单个人物
- 文章能回答原始知乎题目的核心问题

### Phase 7：分支回溯

目标：支持从过去节点创建并运行另一条世界线。

任务：

- 完整保存 `stateBefore`
- 允许选择过去的未选分支
- 创建新 `branchId`
- 从快照恢复状态
- 重新运行后续阶段
- 增加两个分支的对比界面

这一阶段不应阻塞前面的自主模拟 MVP。

## 15. 测试计划

### 15.1 纯函数测试

为 `lib/world-sim-reducer.ts` 和状态合并函数增加最小测试：

- 指标上下限
- 主体状态变化
- 冲突合并
- 硬规则拒绝
- 时间推进
- 分叉检测
- 快照不可变

### 15.2 Schema 测试

每个题型至少覆盖：

- 合法世界种子
- 合法主体列表
- 非法主体 ID
- 缺失指标
- 超出数值范围
- 空事件
- 未知分支 ID

### 15.3 题库兼容测试

从 `SCENARIO_THEMES` 自动遍历主题，确保：

- 每个主题都有 Profile
- 每个题目 ID 能生成请求输入
- 空 `content` 不会导致 Prompt 失败
- 主题皮肤 ID 能继续传递

### 15.4 API 流测试

检查：

- 事件顺序稳定
- Agent 并行完成后才输出快照
- 单个 Agent 失败能正确结束流
- 客户端取消请求时不会继续写入
- `complete` 事件只发送一次

### 15.5 浏览器验证

至少验证：

- 1280px 桌面宽度
- 1440px 桌面宽度
- 390px 手机宽度
- 768px 平板宽度

检查：

- 世界控制台首屏层级
- 时代报告阅读宽度
- 世界线分叉可见性
- 主体卡片换行
- 像素图标加载
- 流式报告更新
- 切换 Tab 后状态不丢失

## 16. 性能与成本控制

### 16.1 Agent 数量

第一版每个阶段 4 到 6 个 Agent。

不要为每个人口群体、每个城市和每个产业单独调用模型。

### 16.2 并行调用

主体模拟可以并行，但要限制：

- 最大并发数
- 单阶段 Token 总量
- 单个主体输出长度
- 失败重试次数

### 16.3 报告压缩

进入下一阶段的 Prompt 只传：

- 当前主体摘要
- 当前指标
- 最近关键事件
- 未解决因果链
- 当前分支信息

不把所有历史原文完整塞给每个 Agent。

### 16.4 缓存

可以缓存：

- 世界种子
- 不变的 Profile
- 已完成的快照

不要缓存依赖当前世界状态的模拟结果，除非缓存 Key 包含完整状态指纹。

## 17. 风险与应对

### 风险 1：Agent 输出看起来仍像聊天

应对：

- Schema 主字段使用 `intent`、`actions`、`events`
- 限制 `reasoningSummary` 长度
- UI 先展示结构化报告
- 不再为每个 Agent 渲染大段气泡

### 风险 2：不同 Agent 只是换名字

应对：

- 每个主体使用不同能力和约束
- Prompt 明确禁止替其他主体决定
- 裁决器检查行动是否符合主体能力
- 用主体状态变化验证独立性

### 风险 3：世界变化过于随机

应对：

- 所有重大事件必须引用已有状态或硬规则
- 事件必须有驱动主体
- 通过因果链解释变化
- 服务端限制跳跃式状态变化

### 风险 4：题型适配失败

应对：

- 主题 Profile 优先于通用 Prompt
- 为每个主题建立固定验收题
- 不强行使用统一指标
- 不存在人类时禁止生成默认人类政治主体

### 风险 5：世界规模变大但玩家看不懂

应对：

- 每阶段只展示 3 到 5 条关键变化
- 提供“为什么”因果链
- 主体档案默认摘要，细节按需展开
- 不让所有 Agent 报告同时占据首屏

### 风险 6：分支系统产生大量存档

应对：

- 第一版只保存结构化分支摘要
- 限制可回溯阶段数量
- 分支回溯放到第二阶段
- 对快照做版本和大小检查

## 18. 第一版明确不做

- 真实地理地图
- 自由文本世界改造
- 每回合神谕能力
- 复杂科技树
- 复杂资源交易
- 几十个微型 Agent
- 每条未选分支的完整并行模拟
- 玩家角色私密目标
- 人物关系信任度作为核心系统
- 角色对话舞台作为主要反馈

这些功能都可能有价值，但会把产品重新拉回“角色互动游戏”，或者显著增加理解成本。

## 19. 最小可交付版本

第一版只需要完成：

```text
一个知乎题目
    ↓
一个反事实世界种子
    ↓
五个异质世界主体
    ↓
三个观测推进选项
    ↓
主体 Agent 并行行动
    ↓
服务端合并状态
    ↓
三个全球事件
    ↓
一条因果链
    ↓
一个自然分叉
    ↓
一份时代报告
```

优先选择以下四个题目做端到端样板：

1. `456699039`：曹操赤壁获胜
2. `399868816`：太阳突然熄灭
3. `357646956`：霸王龙复活
4. `653583054`：人类突然消失几百年

这四题分别覆盖历史、天体、生态和后人类模式。

## 20. 最终判断标准

项目完成这次改造后，打开任意题目，玩家第一眼应该看到：

```text
一个正在自行运行的世界
```

而不是：

```text
几个等待玩家发言的人
```

最终产品的核心表达是：

> 你只改变了一个条件，剩下的历史由整个世界自己写完。
