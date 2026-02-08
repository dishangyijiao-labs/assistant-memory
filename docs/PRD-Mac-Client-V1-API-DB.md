# Assistant Memory Mac Client V1 API/DB 变更清单

**关联文档**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client.md`  
**关联交互稿**：`/Users/zhanghao/CS/project/assistant-memory/docs/PRD-Mac-Client-V1-Interaction.md`  
**版本**：v1.0  
**日期**：2026-02-07

---

## 1. 目标

为 V1 提供可执行的后端契约与数据层方案，覆盖：
1. Session/Message 浏览增强。
2. 手动触发 Insights（默认当前 workspace）。
3. 评分模块与证据回跳。
4. 外部模型 API 可选接入（默认关闭）。

---

## 2. 当前基线（As-Is）

当前已存在接口（`/Users/zhanghao/CS/project/assistant-memory/src/web/server.ts`）：
1. `POST /api/index`
2. `GET /api/stats`
3. `GET /api/search`
4. `GET /api/sessions`
5. `GET /api/session`

当前核心表（`/Users/zhanghao/CS/project/assistant-memory/src/storage/schema.sql`）：
1. `sessions`
2. `messages`
3. `messages_fts` + triggers

结论：浏览基础已具备；缺少 Insights、评分、证据、设置等能力。

---

## 3. API 变更总览（To-Be）

## 3.1 兼容策略
1. 保留现有接口不破坏 Web 端。
2. V1 新能力以新增接口为主，少量扩展老接口参数。
3. 统一错误返回格式，老接口逐步兼容。

## 3.2 接口清单

| 类型 | 接口 | 说明 |
|---|---|---|
| 复用 | `POST /api/index` | 手动索引 |
| 扩展 | `GET /api/sessions` | 增加 workspace/time 过滤 |
| 扩展 | `GET /api/session` | 增加排序与分页参数 |
| 新增 | `GET /api/workspaces` | workspace 列表（Insights 默认范围） |
| 新增 | `POST /api/insights/generate` | 手动生成报告 |
| 新增 | `GET /api/insights` | 报告列表（历史） |
| 新增 | `GET /api/insights/:id` | 报告详情 |
| 新增 | `GET /api/settings/model` | 模型设置读取 |
| 新增 | `PUT /api/settings/model` | 模型设置更新 |
| 新增 | `POST /api/model/test` | 外部 API 连通性测试 |

---

## 4. 接口契约（建议）

## 4.1 扩展：`GET /api/sessions`

Query 参数：
1. `source?`
2. `workspace?`
3. `q?`
4. `time_from?`（ms）
5. `time_to?`（ms）
6. `limit`（默认 50）
7. `offset`（默认 0）

响应：
```json
{
  "sessions": [],
  "total": 0,
  "sourceLabels": {}
}
```

## 4.2 扩展：`GET /api/session`

Query 参数：
1. `session_id`（必填）
2. `order`：`asc | desc`（默认 `asc`，便于阅读）
3. `limit`（默认 2000）
4. `offset`（默认 0）

响应：
```json
{
  "session": {},
  "messages": []
}
```

## 4.3 新增：`GET /api/workspaces`

响应：
```json
{
  "workspaces": [
    { "name": "repo-a", "session_count": 120, "last_at": 1738890000000 }
  ]
}
```

## 4.4 新增：`POST /api/insights/generate`

请求：
```json
{
  "scope": {
    "workspace": "repo-a",
    "time_range": { "from": 1738200000000, "to": 1738890000000 },
    "sources": ["cursor", "claude-code"]
  },
  "model": {
    "mode": "local",
    "provider": null,
    "model_name": null
  }
}
```

响应（同步版，Public Beta 可先用同步）：
```json
{
  "report_id": 12,
  "status": "completed",
  "summary": "...",
  "patterns": [],
  "feedback": [],
  "scores": {
    "efficiency": 78,
    "stability": 71,
    "decision_clarity": 83
  }
}
```

## 4.5 新增：`GET /api/insights`

Query 参数：
1. `workspace?`
2. `limit`（默认 20）
3. `offset`（默认 0）

响应：
```json
{
  "reports": [],
  "total": 0
}
```

## 4.6 新增：`GET /api/insights/:id`

响应：
```json
{
  "report": {},
  "scores": {},
  "evidence": [
    { "claim": "反复修改登录流程", "session_id": 5, "message_id": 188 }
  ]
}
```

## 4.7 新增：模型设置与测试

1. `GET /api/settings/model`
2. `PUT /api/settings/model`
3. `POST /api/model/test`

约束：
1. `external_enabled` 默认 `false`。
2. API Key 不落明文数据库，使用系统 Keychain；DB 仅保存 `key_ref`。

---

## 5. 错误模型（统一）

建议统一为：
```json
{
  "error": {
    "code": "INSIGHTS_MODEL_NOT_CONFIGURED",
    "message": "External model is not configured",
    "request_id": "req_abc123"
  }
}
```

建议错误码：
1. `INVALID_ARGUMENT`
2. `NOT_FOUND`
3. `DB_QUERY_FAILED`
4. `INSIGHTS_GENERATION_FAILED`
5. `INSIGHTS_MODEL_NOT_CONFIGURED`
6. `MODEL_PROVIDER_TIMEOUT`
7. `MODEL_PROVIDER_AUTH_FAILED`

---

## 6. DB 增量设计

## 6.1 新表：`insight_reports`

用途：保存报告主内容与评分。

关键字段：
1. `id INTEGER PRIMARY KEY`
2. `workspace TEXT NOT NULL`
3. `scope_json TEXT NOT NULL`
4. `model_mode TEXT NOT NULL`（`local`/`external`）
5. `provider TEXT`
6. `model_name TEXT`
7. `summary_md TEXT NOT NULL`
8. `patterns_json TEXT NOT NULL`
9. `feedback_json TEXT NOT NULL`
10. `score_efficiency INTEGER NOT NULL`
11. `score_stability INTEGER NOT NULL`
12. `score_decision_clarity INTEGER NOT NULL`
13. `status TEXT NOT NULL`（`completed`/`failed`）
14. `created_at INTEGER NOT NULL`
15. `updated_at INTEGER NOT NULL`

索引：
1. `idx_insight_reports_workspace_created_at`
2. `idx_insight_reports_created_at`

## 6.2 新表：`insight_evidence`

用途：把报告结论映射到具体 message，支持证据跳转。

关键字段：
1. `id INTEGER PRIMARY KEY`
2. `report_id INTEGER NOT NULL`
3. `claim_type TEXT NOT NULL`（`pattern`/`feedback`/`score_reason`）
4. `claim_text TEXT NOT NULL`
5. `session_id INTEGER NOT NULL`
6. `message_id INTEGER NOT NULL`
7. `created_at INTEGER NOT NULL`

索引：
1. `idx_insight_evidence_report_id`
2. `idx_insight_evidence_message_id`

## 6.3 新表：`app_settings`

用途：非敏感配置存储。

字段：
1. `key TEXT PRIMARY KEY`
2. `value TEXT NOT NULL`
3. `updated_at INTEGER NOT NULL`

建议 key：
1. `model.mode_default`
2. `model.external_enabled`
3. `model.provider`
4. `model.base_url`
5. `model.model_name`
6. `model.key_ref`

## 6.4 现有表索引增强

1. `messages(session_id, timestamp)` 复合索引（提升会话详情加载）。
2. `sessions(workspace, last_at)` 复合索引（提升 workspace 默认范围）。

---

## 7. SQL 迁移脚本（草案）

建议新增：`/Users/zhanghao/CS/project/assistant-memory/src/storage/migrations/20260207_insights.sql`

执行内容：
1. `CREATE TABLE IF NOT EXISTS insight_reports ...`
2. `CREATE TABLE IF NOT EXISTS insight_evidence ...`
3. `CREATE TABLE IF NOT EXISTS app_settings ...`
4. `CREATE INDEX IF NOT EXISTS ...`
5. 对 `messages` 与 `sessions` 增加复合索引

迁移原则：
1. 仅增量，不改动已有表结构。
2. 可重复执行（`IF NOT EXISTS`）。

---

## 8. 实现顺序（建议）

1. Step 1：先落 DB migration 与 db.ts 数据访问层。
2. Step 2：扩展 `GET /api/sessions`、`GET /api/session`。
3. Step 3：实现 `GET /api/workspaces` 与 model settings API。
4. Step 4：实现 `POST /api/insights/generate`（先同步版本）。
5. Step 5：实现报告历史与详情 API。
6. Step 6：补充错误码、契约测试、回归测试。

---

## 9. Public Beta 验收标准（API/DB）

1. 旧接口兼容：现有 Web 页面功能无回归。
2. 新接口可覆盖交互稿所有状态流。
3. 报告生成后评分和证据可持久化并可读取。
4. 外部模型默认关闭，未配置时不会发出外部请求。
5. 所有 DB 迁移可在空库和已有库上成功执行。

