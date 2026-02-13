# AssistMem：好问题标准（可测量定义）

本文档定义 AssistMem 产品语境下「更好的提问」的可测量标准，作为 RAG、Agent 分析和 Eval 的北极星。

---

## 1. 产品目标回顾

- **输入**：本地 AI 聊天历史（Cursor、Copilot、Claude Code、Codex、Gemini 等）
- **输出**：让用户更好地提问，提升与 AI 协作的效率
- **核心回路**：分析聊天数据 → 给出 actionable 反馈 → 用户改进提问 → 对话效果提升

「好问题」的标准必须可测量，才能指导分析、生成反馈，并在后续迭代中验证有效性。

---

## 2. 可测量标准（工程化）

| 维度 | 标准 | 可测量方式 | 数据来源 |
|------|------|------------|----------|
| **上下文** | 是否提供 workspace / 技术栈 | 是否非空、是否被 quality analyzer 识别 | `workspace`, `prior_assistant` |
| **约束** | 是否有已知约束、接受标准 | `known_constraints`, `acceptance_criteria` 是否非空 | quality-kit schema |
| **可复现** | 是否有 env/version/reproduce 信息 | 关键词命中（node/python/go 版本、报错信息等） | 关键词/正则检测 |
| **效率** | 单次 session 的 user turn 数 | `avg_follow_up_rounds` < 阈值 | 已有 KPI |
| **结果** | 是否在较少轮次内解决 | session 短且无反复追问 | `message_count`, `user_turn_count` |

### 与现有 quality-kit 的对应关系

当前 `QUALITY_ANALYZER_OUTPUT_SCHEMA` 中的 deductions 已覆盖部分维度：

- `missing_context` → 上下文不足
- `missing_constraints` → 约束缺失
- `missing_acceptance` → 接受标准缺失
- `ambiguous_goal` → 目标不清晰
- `missing_repro` → 缺可复现步骤
- `missing_io` → 缺输入/输出示例

**结论**：quality-kit 的评分逻辑已经与「好问题」的多个维度对齐，可作为 baseline；后续可在此基础上补充「成功对话」的启发式定义。

---

## 3. 「成功对话」的启发式定义（待落地）

为支撑 Eval 和反馈有效性验证，需要定义「什么算一次成功对话」。候选启发式（可组合）：

| 启发式 | 定义 | 实现难度 |
|--------|------|----------|
| **短轮次** | user turn ≤ 3 且 assistant 有实质性代码/解释输出 | 低 |
| **无反复追问** | 同一语义的 user 提问不重复出现 | 中（需相似度） |
| **有验证** | 对话中出现 run/test/execute 等可执行验证 | 低（关键词） |
| **用户满意** | 若有 thumbs up/down 等反馈，取正向 | 高（依赖数据源） |

初期建议：先用 **短轮次 + 有验证** 作为「成功」的简化定义，待有更多数据后再引入相似度与显式反馈。

---

## 4. 与 5 条通用好问题标准的映射

| 通用标准 | 在 AssistMem 中的对应 | 当前实现 |
|----------|------------------------|----------|
| 第一性原理 | 问的是「要解决什么问题」而非「怎么改这段代码」 | quality: `ambiguous_goal` |
| 高风险假设 | 明确环境、版本、复现步骤，减少无效假设 | quality: `missing_repro`, `missing_io` |
| 结果导向 | 有 acceptance criteria，对话有明确完成标志 | quality: `missing_acceptance` |
| 显性权衡 | 说明约束（时间、兼容性、技术栈） | quality: `missing_constraints` |
| 解法中立 | 描述目标与边界，不限制实现方式 | 待 quality prompt 显式强调 |

---

## 5. RAG 实现状态

当前已实现最简 RAG 流：

- **检索**：`storage/queries/rag.ts` — `retrieveSimilarUserQuestions()` 通过 FTS5 检索相似 user 消息，可过滤 `score >= 80`
- **注入**：`insights/quality-analyzer.ts` — 在 `analyzeOneMessage` 中，将检索到的正例注入 `buildQualityAnalyzerUserPrompt` 的上下文
- **流程**：用户提问 → FTS5 检索相似高 quality 历史 → 作为 few-shot 注入 LLM → 生成针对性评分与改写建议

---

## 6. 对 Agent 的指导

1. **RAG 检索**：用 FTS5 检索与当前问题**语义相近**的历史对话，重点找「高 score、高 grade」的 user 提问作为正例。已实现。
2. **Agent 工具**：`search_sessions`、`get_session`、`retrieve_similar_questions`、`get_quality_kpi` 已实现，支持 Agent 自主调用。
3. **反馈生成**：LLM 的 system prompt 明确引用可测量标准，要求输出**具体、可执行**的改写建议。
4. **Eval**：已实现。每次 quality analyzer 给消息打分后，若该消息是 session 中「前一个 user 消息」的后续，则记录 (prior_score, next_score) 到 `eval_question_pairs`。CLI `assistmem eval-report` 和 API `GET /api/eval/stats` 可查看 improvement rate、avg delta 等。

---

## 7. 附录：quality-kit 现有 schema 速查

```json
{
  "score": "0-100",
  "grade": "A/B/C/D/F",
  "deductions": [
    { "code": "missing_context|missing_constraints|missing_acceptance|ambiguous_goal|missing_repro|missing_io", "reason": "...", "points": N }
  ],
  "missing_info_checklist": ["string"],
  "rewrites": { "short": "...", "engineering": "...", "exploratory": "..." }
}
```
