# Assistant Memory Mac Client V1 详细交互稿

**关联文档**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client.md`  
**文档版本**：v1.0  
**日期**：2026-02-07  
**适用阶段**：M1-M3（Public Beta 前）

---

## 1. 目标与范围

本稿用于定义 V1 可落地交互，覆盖：
1. 左侧 `Sessions` 列表浏览与过滤。
2. 右侧 `Messages` 时间线阅读与定位。
3. 手动触发 `Insights` 报告（默认当前 workspace）。
4. 评分模块展示（效率/稳定性/决策清晰度）。

不包含：
1. 自动定时报告。
2. 行动项勾选清单。
3. 多人协作与云端账号体系。

---

## 2. 信息架构与导航

```
App Shell
├── Main（默认页）
│   ├── Left Pane: Sessions
│   └── Right Pane: Messages
├── Insights Panel（覆盖层/右侧抽屉）
└── Settings（独立页）
```

导航规则：
1. 启动后默认进入 `Main`。
2. `Insights` 通过按钮手动打开，不离开当前 `Main` 上下文。
3. `Settings` 从顶部菜单进入，返回后保持原会话与滚动位置。

---

## 3. 全局交互约定

## 3.1 时间与排序
1. Sessions 默认按 `last_at DESC`。
2. Messages 默认按 `timestamp ASC`（阅读顺序）；支持切换 `DESC`。
3. 所有时间按本地时区显示。

## 3.2 默认范围
1. Insights 默认范围：当前选中 session 所在 `workspace`。
2. 若未选中 session，则使用最近活跃 workspace。

## 3.3 快捷键
1. `/`：聚焦搜索框。
2. `j` / `k`：上下切换 session。
3. `Enter`：打开当前高亮 session。
4. `Cmd+I`：打开 Insights 面板。
5. `Esc`：关闭 Insights / 关闭弹窗。

## 3.4 通用状态提示
1. 载入中：骨架屏（list skeleton + message skeleton）。
2. 空状态：明确下一步动作（去索引、清空筛选、切换 workspace）。
3. 错误态：错误原因 + 重试按钮 + 可选日志入口。

---

## 4. 页面级交互

## 4.1 Main 页面（Sessions + Messages）

## 4.1.1 布局结构
1. 顶栏（固定）：
   - Workspace scope（当前 workspace 名称）。
   - Source Filter（All/Cursor/Copilot/Cursor CLI/Claude Code/Codex/Gemini）。
   - Search 输入框（按 workspace 或 external_id）。
   - `Index Now` 按钮。
   - `Generate Insights` 按钮。
2. 左栏（280-340px）：
   - Session 列表，支持分页或虚拟滚动。
   - 每项字段：source、workspace、last_at、message_count。
3. 右栏（自适应）：
   - Header：session 标题、来源、时间、消息总数。
   - Message 列表：role、timestamp、content。

## 4.1.2 Session 列表项交互
1. 单击：加载对应 Messages。
2. 上下键移动焦点不立即发请求，按 Enter 后请求详情。
3. Hover 显示快捷信息：external_id（截断可复制）。
4. 当前选中项高亮，并同步更新顶部 workspace scope。

## 4.1.3 Message 区交互
1. 支持 role 样式区分：`user`、`assistant`、`system`。
2. 单条消息支持 `Copy`。
3. 支持 `Copy Session`（复制当前会话全文）。
4. 支持从搜索结果或报告证据跳转并高亮某条 message。

## 4.1.4 搜索与过滤交互
1. 搜索提交后仅刷新 Sessions，不重置 source filter。
2. 切换 source filter 时默认回到第一页。
3. 搜索无结果时显示 `No sessions found`，保留当前筛选条件。

## 4.1.5 Index 交互
1. 点击 `Index Now` 后按钮进入 loading 态并禁用。
2. 显示阶段文案：`Scanning sources` -> `Writing database` -> `Done/Failed`。
3. 成功后自动刷新 session 列表并回到第一页。
4. 失败时显示错误摘要与重试。

---

## 4.2 Insights 面板（手动触发）

## 4.2.1 打开前置
1. 必须手动点击 `Generate Insights`（或 `Cmd+I`）。
2. 若无可用消息数据，面板显示空态并提示先索引。

## 4.2.2 面板结构
1. Header：
   - 标题：`Insights`
   - 当前范围摘要：`workspace + 时间范围 + 来源`
   - `Generate` 按钮
2. Scope 配置区：
   - Workspace（默认当前，允许切换）。
   - Time Range（7d/30d/90d/custom）。
   - Sources（多选）。
3. Model 配置区：
   - Mode: `Local` / `External API`
   - Provider（External 模式下可选）
   - API Key 状态（已配置/未配置）
4. 报告结果区（生成后）：
   - Summary
   - Patterns
   - Feedback（3-5 条文本建议）
   - Scores（效率/稳定性/决策清晰度）
   - Evidence Links（可跳转 message）

## 4.2.3 生成流程
1. 用户点击 `Generate`。
2. 面板进入 progress 态，展示 3 步：
   - Collecting conversations
   - Analyzing patterns
   - Drafting report
3. 生成完成后滚动到结果区顶部。
4. 支持 `Copy Markdown` 与 `Export .md`。

## 4.2.4 评分模块规则（交互要求）
1. 显示三个分数：0-100。
2. 每个分数必须配 `Why` 文案（扣分依据）。
3. 每个依据至少可追溯到 1 条 evidence 消息链接。

---

## 4.3 Settings 页面

V1 必备项：
1. 数据源与 DB 路径展示。
2. External API 总开关（默认 Off）。
3. Provider 配置（Base URL、Model、API Key）。
4. 隐私声明：开启 external 后哪些内容会发送。
5. `Test Connection` 与失败错误提示。

---

## 5. 状态级设计（State Model）

## 5.1 主状态

```ts
type AppState = {
  selectedSessionId: number | null;
  currentWorkspace: string | null;
  sourceFilter: "all" | "cursor" | "copilot" | "cursor-cli" | "claude-code" | "codex" | "gemini";
  sessionQuery: string;
  sessionListStatus: "idle" | "loading" | "ready" | "empty" | "error";
  sessionDetailStatus: "idle" | "loading" | "ready" | "empty" | "error";
  insightsStatus: "closed" | "idle" | "generating" | "ready" | "error";
  insightsScope: {
    workspace: string | null;
    timeRange: "7d" | "30d" | "90d" | "custom";
    sources: string[];
  };
  modelMode: "local" | "external";
};
```

## 5.2 状态迁移
1. 启动：`idle -> loading -> ready/empty/error`。
2. 选 session：`sessionDetail idle -> loading -> ready/error`。
3. 打开 insights：`closed -> idle`。
4. 点击生成：`idle -> generating -> ready/error`。
5. 关闭 insights：`ready/error -> closed`（保留上次范围配置）。

---

## 6. 异常与边界场景

1. DB 不存在：提示 `No database found` + 一键触发索引。
2. Session 存在但 message 为空：右侧显示空态，不报错。
3. External API 未配置即选择 external：禁用 Generate 并提示配置。
4. 报告生成超时：显示超时提示与重试按钮。
5. 切换 session 时若正在生成 insights：
   - 不中断当前生成。
   - 提示“报告仍基于触发时范围”，避免理解偏差。

---

## 7. Public Beta 验收用例（交互向）

1. 用户可在 3 次点击内打开任一 session 并读到消息正文。
2. 搜索 + 来源过滤可组合使用，且结果正确刷新。
3. Insights 可手动生成，默认范围为当前 workspace。
4. 评分模块稳定展示且每个分数有解释。
5. 证据链接可回跳到 message 并高亮。
6. External API 关闭时不会触发外发请求。
7. External API 开启并配置有效时可成功生成报告。

---

## 8. 交付建议（设计/研发）

1. 设计交付：
   - Main 页面高保真（含 loading/empty/error）。
   - Insights 面板高保真（含 generating 与 result）。
   - 交互标注（快捷键、滚动、高亮、禁用态）。
2. 研发交付：
   - 前端状态机与 API 契约同步。
   - 关键路径埋点（仅本地统计或可关闭）。
   - 错误码字典（索引、查询、模型调用）。
