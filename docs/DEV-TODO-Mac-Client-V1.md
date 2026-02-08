# Assistant Memory Mac Client V1 研发 TODO

**关联 PRD**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client.md`  
**关联交互稿**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client-V1-Interaction.md`  
**关联 API/DB 清单**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client-V1-API-DB.md`  
**版本**：v1.0  
**日期**：2026-02-07

---

## Milestone A：数据层（DB + Storage）

- [x] A1. 扩展 `schema.sql`
  - 新增 `insight_reports`、`insight_evidence`、`app_settings`
  - 新增性能索引：`messages(session_id,timestamp)`、`sessions(workspace,last_at)`
- [x] A2. 扩展 `src/storage/db.ts`
  - sessions 查询支持 `workspace/time_from/time_to`
  - session 详情支持 `order/limit/offset`
  - 新增 workspace 列表查询
  - 新增 model settings 读写
  - 新增 insight report/evidence 持久化与读取
- [x] A3. 保持旧接口兼容
  - 现有 `search/sessions/session/stats` 行为无破坏

**A 验收标准**
1. 老数据可直接打开，schema 可重复执行。
2. 新增查询在空库/有数据库均可运行。

---

## Milestone B：API 层（Web Server）

- [x] B1. 扩展接口
  - `GET /api/sessions` 支持 `workspace/time_from/time_to`
  - `GET /api/session` 支持 `order/limit/offset`
- [x] B2. 新增接口
  - `GET /api/workspaces`
  - `GET /api/settings/model`
  - `PUT /api/settings/model`
  - `POST /api/model/test`
  - `POST /api/insights/generate`
  - `GET /api/insights`
  - `GET /api/insights/:id`
- [x] B3. 错误模型统一
  - 返回 `error.code + error.message`

**B 验收标准**
1. 新接口参数校验正确，异常返回稳定。
2. 旧页面仍可正常加载 sessions/session/index。

---

## Milestone C：Insights 引擎

- [x] C1. 本地生成器（rule/statistics）
  - summary/patterns/feedback/scores
  - 分数：efficiency/stability/decision_clarity
- [x] C2. 证据映射
  - 每条 pattern/feedback/score reason 至少 1 条 message 证据
- [x] C3. 外部模型模式（可选）
  - 支持 external mode 配置校验与连通性测试
  - 默认关闭，不配置不外发

**C 验收标准**
1. 可在默认 workspace 上手动生成报告。
2. 报告可持久化并通过详情接口读取。

---

## Milestone D：质量门槛

- [x] D1. TypeScript 编译通过：`npm run typecheck`
- [x] D2. 关键路径自测（已在本机提权环境完成 API 冒烟）
  - index -> sessions -> session
  - settings -> model test
  - insights generate -> insights list/detail

**D 验收标准**
1. 无 TypeScript 错误。
2. API 关键路径可完成一轮本地验证。

---

## Milestone E：前端联调（Web 原型）

- [x] E1. 在现有 Web 端增加 Insights 入口页
- [x] E2. 接通生成/历史/详情/设置/测试 API
- [x] E3. 展示评分与证据跳转链接

**E 验收标准**
1. 可从会话页进入 Insights 页面。
2. 可手动生成报告并查看历史与详情。

---

## Milestone F：Mac 客户端壳（Tauri）

- [x] F1. 初始化 `src-tauri` 工程（v2）
- [x] F2. 新增桌面入口页 `desktop/web/index.html`
- [x] F3. Release 模式启动本地 backend 并清理子进程
- [x] F4. 新增脚本：`desktop:dev` / `desktop:build` / `desktop:check`
- [x] F5. Rust 编译校验（`cargo check` 已通过）

**F 验收标准**
1. `npm run desktop:dev` 可启动桌面壳并打开本地页面。
2. 关闭桌面应用后后台 `node dist/index.js serve` 子进程被回收。

---

## 执行记录

- [x] 第一轮开发完成（A+B+C 基础能力）
- [x] 第二轮修正与回归（含本机 API 冒烟与环境修复）
- [x] 前端联调基础页面完成（Web 原型）
- [x] Tauri 壳基础结构完成
