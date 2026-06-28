# Hall of Fame Studio — 开发路线图

> **当前状态：Pre-alpha（不可用）**  
> 本项目仍处于早期研发阶段，**尚未达到可日常使用或对外发布的标准**。  
> 安全机制未完备，请勿用于真实项目、生产环境或敏感数据。

---

## 一、给 Visitor / Contributor 的 30 秒说明

| 问题 | 答案 |
|------|------|
| 现在能用吗？ | **不能。** UI 与演示流程可本地运行，但不构成可靠产品。 |
| 能部署给团队用吗？ | **不能。** 无生产级安全、无稳定运行时、无 SLA。 |
| 能接 API Key 跑真实任务吗？ | **仍不建议。** 已有模型/搜索 provider 状态、provider readiness 闸门、provider policy/usage ledger、本地 secret-vault 契约与基础 redaction 原型，但正式身份权限、托管 KMS/密钥轮换和托管审计仍未达到生产要求。 |
| 现在适合做什么？ | 阅读架构、参与 Skill 设计、讨论协作协议、提交 Issue/PR。 |
| 我们卡在哪？ | **阶段 1 → 阶段 2 之间**（见下文）。 |

---

## 二、总体进程规划

完整交付路径分为 **六个里程碑**。前三个是当前核心研发主线；后三个是发布前必做项。

### 验收样例：Research Project

Research Project 是早期用于验收通用产品团队能力的样例场景，而不是单独的垂直产品方向。它的价值在于同时覆盖一个产品团队应具备的核心动作：开会讨论、主动搜集信息、头脑风暴、写作产出、评审修订、群聊协作、节点提交和最终交付。

开发时应避免把逻辑写死为“论文工具”或“研究工具”。Research Project 跑通后，相关能力应能迁移到产品策划、市场分析、技术方案、内容生产、品牌策略等一般项目形态。

```
M0 原型壳层          ████████████████████  已完成
M1 人物 Skill 设计   ████████░░░░░░░░░░░░  ← 当前主战场
M2 Agent 协作机制    ██████░░░░░░░░░░░░░░  进行中（骨架已有）
M3 运行算法 Runtime  ████░░░░░░░░░░░░░░░░  原型级（非生产）
M4 安全与 BYOK       ██░░░░░░░░░░░░░░░░░░  原型启动
M5 公开发布          ░░░░░░░░░░░░░░░░░░░░  未开始
```

---

## 三、各阶段说明

### M0 · 原型壳层 ✅ 已完成

**目标：** 验证产品形态与交互叙事，而非交付可用系统。

**已交付：**
- React + Vite 本地原型 UI（Dashboard、Pantheon、圆桌、项目工作区）
- 40 个人物卡片与雷达档案展示
- Manager Demo 一键种子数据
- 浏览器 `localStorage` 持久化（仅演示）

**不代表：** 系统已可托管真实协作。

**相关路径：** `src/App.jsx`、`docs/assets/`、`scripts/validate-agent-manager-scenario.mjs`

---

### M1 · 每个人单独的 Skill 设计 🔄 **当前主战场**

**目标：** 每个人物是可独立调用、可验证、可 dist 的标准 Skill 包，而非一句 prompt 或一张卡片。

**进行中：**
- `skills/hall-of-fame-personas/source/personas/{slug}/` 源包结构（`persona.json`、`prompt.md`、`memory.md`、`examples.md`、`regression.json`）
- Schema 校验、回归用例、mindframe 生成、registry 编译流水线
- 人物任务匹配与圆桌发言排序（`persona_runtime.py`）

**尚未完成：**
- 全部 40 个人物的认知深度与行为回归达标
- 跨人物风格差异在真实 LLM 调用下的一致性验证
- Skill 版本化与发布策略

**Contributor 可参与：**
- 按 [`references/persona-authoring-template.md`](skills/hall-of-fame-personas/references/persona-authoring-template.md) 完善单人物包
- 运行 `npm run skills:check` 确保 schema + regression 通过
- 阅读 [`人物Skill系统.md`](人物Skill系统.md) 与 [`skills/hall-of-fame-personas/SKILL.md`](skills/hall-of-fame-personas/SKILL.md)

**退出标准（进入 M2 硬门槛）：**
- [ ] 核心人物 roster 通过 regression
- [ ] 单人物 Skill 可独立 dist，无外部工具指纹残留
- [ ] 任务匹配 Top1/Top3 行为符合 baseline cases

---

### M2 · Agent 协作机制 🔄 进行中

**目标：** 多 Agent 在圆桌、群聊、分工、Lead/Reviewer 治理下可预测地协作，而非随机对话。

**已有骨架：**
- 五层 Agent 模型（Identity / Mind / Relations / Communication / Work Cycle）
- 会议话术框架（Kickoff / Sync / Change / Escalation）
- Lead 指派、Reviewer 挑战、attention-scored 发言路由
- 协作健康检查 `evaluateCollaborationState`

**尚未完成：**
- 协作不变量在复杂场景下的压力测试
- 跨会议状态一致性（charter → obligations → ledger）
- Agent 自我说明 / 自荐 / Leader campaign 在流程图中的一等节点表达
- 与真实 LLM 输出结合的容错与重试策略
- 多人贡献时的协议版本管理

**Contributor 可参与：**
- 阅读 [`src/agents/README.md`](src/agents/README.md) 与 [`src/agents/ARCHITECTURE_AUDIT.md`](src/agents/ARCHITECTURE_AUDIT.md)
- 补充 scenario 验证脚本与边界用例
- 在 Issue 中讨论「谁该说话、何时升级、如何记录决策」规则

**退出标准：**
- [ ] Manager Demo scenario 覆盖主要协作路径且可重复
- [ ] Research Project 作为通用产品团队验收样例，覆盖会议、脑暴、群聊协作与角色分工，不引入 research-only 协议
- [ ] 会议 → 任务 → 群聊 → 自治周期 全链路无断点
- [ ] Agent 自我说明、角色自荐、Leader campaign 能作为流程图证据节点查看
- [ ] 协作诊断信息对 Contributor 可读、可调试

---

### M3 · 整个运行算法 🔄 原型级

**目标：** Hour Pulse / Day Report 自治循环、项目账本、变更 ledger 在统一 runtime 下稳定推进。

**已有原型：**
- `planAutonomousWorkCycle` + `advanceAutonomousProjectCycle`
- Manager Flow Graph emits proofed role-clarification nodes and first-class `self-marketing` nodes for role self-nominations and Leader campaign pitches.
- Readiness Proof Map exposes `roleNegotiationRoutes` and `selfMarketingRoutes`, covered by `npm run agents:product-team`.
- Artifact revision lineage links requested-changes reviews to revision-note/final-deliverable submissions, superseded drafts, resolved obligations, Flow Graph `revision` edges, and Readiness Proof Map `revisionRoutes`.
- Evidence searches now compute source `qualityScore`/`qualitySignals` plus aggregate `evidenceJudgement`, visible in Manager Dashboard, Flow Graph, Task Evidence, and Readiness Proof Map.
- Evidence quality audit is exposed by `GET /projects/:id/evidence-quality-audit` and Manager Ready Package as `evidence-quality-audit/v1`, aggregating evidence rows, per-source quality/safety signals, provider provenance, Proof Map routes, decision gates, production controls, and checksum. The product-team Harness now requires it through in-process API, real HTTP backend, project archive manifest, security route policy, and Manager UI snapshot.
- Evidence source review workflow is exposed by `GET /projects/:id/evidence-source-review-workflow` and Manager Ready Package as `evidence-source-review-workflow/v1`, deriving reviewer-visible source review items, source review queue, proof routes, gates, production controls, and checksum from the evidence quality audit. The product-team Harness now requires it through in-process API, real HTTP backend, project archive manifest, production launch evidence routes, security route policy, and Manager UI snapshot while production human review/source snapshot storage remains blocked.
- Real Node HTTP scheduler status/tick coverage is now part of `npm run agents:product-team`, proving the same generic product-team acceptance sample can be advanced by backend project and Agent workers without a browser tab.
- MVP readiness is exposed by `GET /projects/:id/mvp-readiness` and Manager Ready Package, separating local-pilot readiness from production blockers.
- Private pilot launch readiness is exposed by `GET /projects/:id/pilot-launch-readiness` and Manager Ready Package. It returns `pilot-launch-readiness/v1` with a private-pilot go/no-go decision, production no-go decision, launch packet checksum, evidence routes, failed gates, and production blockers aggregated from MVP readiness, proof routes, security boundary, provider readiness, managed persistence, queue adapter, operations readiness, and incident drill receipts.
- Deployment preflight is exposed by `GET /projects/:id/deployment-preflight` and Manager Ready Package. It returns `deployment-preflight/v1` with private-pilot deployment blocker gates, warnings, production controls, backend store/scheduler status, access-control hardening flags, secret-vault readiness, provider policy status, adapter status, adapter gateway preflight, operations readiness, and a checksum while keeping `productionDeploymentReady: false`.
- Production launch audit is exposed by `GET /projects/:id/production-launch-audit` and Manager Ready Package. It returns `production-launch-audit/v1` with unified private-pilot and production decisions, private-pilot gates, private-pilot handoff gates, production gates, audit-integrity gates, evidence routes, project evidence handoff summary, production blockers, next-shortest-path guidance, and a checksum. The product-team Harness now requires private-pilot `go` for the completed acceptance project, points next-shortest-path to `private-pilot-handoff` until the local evidence export package is download-audited, and keeps production `no-go`.
- Launch approval workflow is exposed by `GET|POST /projects/:id/launch-approvals` and Manager Ready Package. It returns `launch-approval-workflow/v1`, persists `launch-approval/v1` records for private-pilot and production release modes, requires Manager + security-admin approval for private pilot, requires operations-owner for production, and mirrors approval proof into Manager Flow Graph, Readiness Proof Map, event ledger, timeline, production launch audit, and the `launch_approvals` persistence/migration seed path.
- Project evidence archive is exposed by `GET /projects/:id/project-evidence-archive` and summarized in Manager Ready Package. The standalone route returns full `project-evidence-archive/v1` redacted contents with manifest checksums, integrity gates, final-deliverable/transcript/evidence/review/Flow-Graph proof, readiness summaries, persistence summary, worker recovery summary, and raw-secret scan status; Manager Ready Package keeps a manifest-only snapshot with the same route, status, gates, counts, and checksums for dashboard responsiveness. This closes the private-pilot/customer handoff proof surface while keeping production-grade export/download infrastructure as M4/M5 work.
- Project evidence export governance is exposed by `GET|POST /projects/:id/project-evidence-exports` and summarized in Manager Ready Package. It returns `project-evidence-export-workflow/v1`, persists `project-evidence-export/v1` request/approval/download-audit rows, pins requests to archive checksums, requires Manager + security-admin approval for private-pilot handoff, mirrors proof into Manager Flow Graph, Readiness Proof Map, timeline, event ledger, route policy, and `project_evidence_exports` persistence rows, and now returns a local `project-evidence-export-package/v1` descriptor after download audit with archive manifest checksums, watermark metadata, retention/data-residency metadata, package gates, and a receipt. It keeps `readyForProductionExport: false` until encrypted object storage, signed download URLs, watermark enforcement, retention deletion, centralized download audit, and data-residency controls exist.
- Production persistence snapshot is exposed by `GET /projects/:id/persistence-snapshot`, giving the future managed database migration a normalized table/checksum/integrity contract while the app still uses the local JSON file store.
- Managed persistence migration plan is exposed by `GET /projects/:id/persistence-migration-plan`, deriving Postgres-compatible table plans, seed batches, RLS guidance, critical-table coverage, verification gates, and cutover steps from the current persistence snapshot.
- Managed persistence dry-run verification is exposed by `GET /projects/:id/persistence-migration-dry-run`, simulating the adapter import contract against the snapshot to check seed coverage, row counts, checksums, primary-key uniqueness, RLS guidance, and migration-plan gates before a real managed database adapter is wired in.
- Managed persistence adapter plan and dry-run are exposed by `GET /projects/:id/persistence-adapter-plan` and `GET /projects/:id/persistence-adapter-dry-run`, turning the database cutover blocker into a concrete adapter contract with critical table coverage for membership/replay/audit/provider/worker/read-model records plus a configurable adapter status facade. The default `local-shadow` driver produces local execution receipts for shadow-read parity, transaction rollback, backup/restore, RLS coverage, audit-stream continuity, and read-model checkpoint gates. `http-json` now has an async gateway dry-run path through the project API when `MANAGED_PERSISTENCE_HTTP_ENDPOINT` or `ADAPTER_GATEWAY_HTTP_ENDPOINT` is configured; `postgres` remains a future real-driver target.
- Worker queue snapshot is exposed by `GET|POST /workers/queue-snapshot` and `GET|POST /projects/:id/worker-queue`, giving future queue/cron infrastructure a due-row, priority, idempotency, lease, retry/dead-letter, execution receipt, and recovery-route contract while the app still uses the local Node scheduler.
- Worker queue adapter plan and dry-run are exposed by `GET /projects/:id/worker-queue-adapter-plan` and `GET /projects/:id/worker-queue-adapter-dry-run`, turning the queue/cron blocker into a configurable adapter contract. The default `local-shadow` driver produces local execution receipts for enqueue, durable lease acquisition, dispatch, receipt acknowledgement, retry import, dead-letter recovery, queue inspection, `worker-queue-adapter-snapshot-parity/v1` queue/lease/ack/dead-letter parity, and adapter gate checks. `http-json` now has an async gateway dry-run path through the project API when `WORKER_QUEUE_HTTP_ENDPOINT` or `ADAPTER_GATEWAY_HTTP_ENDPOINT` is configured; `managed-queue` remains a future real queue adapter target.
- Adapter gateway contract validation is exposed by `npm run adapters:gateway`, which spins up local mock `http-json` gateways, verifies shared health, managed persistence execution receipt, and worker queue execution receipt shapes, then proves the project API dry-run routes can execute through that gateway before a real private adapter gateway exists.
- A runnable private adapter gateway reference process is exposed by `npm run adapters:gateway-server`. It serves `GET /health`, `GET /state`, `POST /persistence/dry-run`, and `POST /worker-queue/dry-run`, supports bearer auth through `ADAPTER_GATEWAY_AUTH_TOKEN`, persists imported shadow table records, queue rows, queue leases, dead-letter rows, and receipt summaries through the `ADAPTER_GATEWAY_STORAGE_DRIVER` adapter contract, and is verified by `npm run adapters:gateway-server:validate` against the shared client contract, backend project API dry-run routes, and `GET /projects/:id/adapter-gateway-preflight` live health/state/capability checks. The current drivers are `json-file`, `memory`, and `postgres` / `postgres-compatible`; `npm run adapters:gateway-postgres-store:validate` proves the Postgres-compatible schema plan, query-bound write operations, and snapshot/count readback parity with a fake query shim. A real managed database/queue driver with real database readback remains the next production gap.
- Operations readiness is exposed by `GET /projects/:id/operations-readiness`, combining worker proof, queue contract, queue adapter dry-run, execution receipts, retry/dead-letter recovery metrics, audit stream ordering plus hash-chain verification, persistence integrity, migration dry-run status, proof surfaces, alert-rule drafts, a recovery runbook, and `operations-incident-drill/v1` rehearsal receipts into one local operations contract; production still needs centralized observability, incident ownership, backup/restore drills against real infrastructure, durable queue leases, managed dead-letter storage, and real alert routing.
- Provider readiness is exposed by `GET /projects/:id/provider-readiness` and Manager Ready Package, turning the real-provider rollout blocker into a local contract with redacted model/search status, deterministic validation-provider proof, provider-backed evidence provenance, source-safety review, proof routes, leak scanning, provider control policy, allowlists, budgets/rate limits, Agent tool grants, retry policy, circuit-breaker policy, local secret-vault seal/open/rotation receipt status, provider usage/cost ledger rows, and explicit remaining production controls for managed KMS, revocation, managed provider audit storage, centralized alerting, and real-provider incident handling.
- Security boundary snapshot is exposed by `GET /projects/:id/security-boundary` and Manager Ready Package, giving the secret-vault/RBAC blocker a route policy, enforced access-policy, optional signed access-header contract, optional signed-request replay contract, optional audit fail-closed contract, optional project membership contract, local encrypted secret-vault contract, sensitive-field, redaction-scan, and production hardening contract while the prototype still lacks real identity/session infrastructure.
- `accessControl.js` provides prototype enforced-mode decisions for Manager, Agent, Reviewer, runtime, security-admin, and observer roles, including Agent self-scope, Reviewer identity match, sensitive export denial, optional HMAC-signed identity headers when `AGENT_ACCESS_SIGNING_SECRET` is configured, optional file-backed signed request id replay checks when `requireSignedRequestIds` / `AGENT_ACCESS_REPLAY_PROTECTION` is enabled, optional audit fail-closed rejection when `failClosedOnAuditError` / `AGENT_ACCESS_AUDIT_FAIL_CLOSED` is enabled, and persisted project membership policy checks with runtime bindings, revocations, revision audit, and `project_membership_policies` / `project_membership_grants` persistence rows when the API enables `requireProjectMembership`; `access_replay_records`, migration-plan verification gates, and migration dry-run gates are also covered by `npm run agents:product-team`.
- Security access audit is exposed by `GET /projects/:id/security-access-audit` and `GET /projects/:id/security-audit-stream`, written into project state, linked into the event ledger, persisted into the backend store-level audit stream with sequence/checksum plus tamper-evident hash-chain proof, mirrored to an append-only JSONL audit sink, and exported through the persistence snapshot as `security_access_audit` plus `security_audit_stream`; production still needs immutable centralized audit storage.
- 确定性 runtime（`agentRuntime.js`）用于 UI 演示
- 自治 ledger、agentStates、obligation 持久化契约
- 通用 Agent submission / artifact / evidence-search / submission-review 后端契约，已由 `npm run agents:product-team` 覆盖 Research Project 验收样例的后端链路

**尚未完成：**
- LLM 驱动的真实工作产出（当前大量为规则/模板生成）
- 生产级 managed database adapter 替代当前 JSON/file store，并把现有 `postgres` / `postgres-compatible` gateway schema/upsert/readback rehearsal 升级为真实数据库连接下的 shadow-read、backup/restore、rollback、RLS 与 cutover 演练
- 生产级 queue/cron scheduler 替代当前本地 Node interval runner，并实现 `http-json` 或 `managed-queue` driver，把本地 queue shadow execution receipt 升级为真实 durable lease store、managed dead-letter storage 与恢复演练
- 将 `adapterGatewayStore.js` 的 `json-file` / `memory` / `postgres-compatible` storage adapter rehearsal 替换为真实私有 adapter gateway 后端：托管数据库真实 readback parity、shadow-read、backup/restore、rollback、RLS 验证，以及真实 durable queue lease / managed dead-letter storage
- 将 `npm run adapters:gateway`、`npm run adapters:gateway-server:validate`、`GET /projects/:id/adapter-gateway-preflight` 和项目级 dry-run API 纳入针对真实私有 adapter gateway 的部署前验收
- Agent 提交系统的生产级 UI 操作、多轮评审版本管理、真实外部搜索适配与生产级持久化
- 运行时与 Skill 包的热更新策略
- 性能与成本控制（token、并发、缓存）

**Contributor 可参与：**
- 扩展 `npm run agents:scenario` 覆盖更多项目形态
- 文档化 runtime 输入/输出契约，便于未来替换 LLM backend

**退出标准：**
- [ ] Runtime 契约冻结并文档化
- [ ] 自治周期在 N 轮模拟中状态一致
- [ ] Research Project 验收样例能跑通信息搜集、内容撰写、脑暴节点、群聊讨论、产出提交、正式评审与最终交付，但底层 artifact / submission / evidence-search / review 契约保持通用
- [ ] Agent submission / evidence-search / review node 契约冻结，并能从任务、群聊、事件账本、工作区文件追溯证据
- [ ] 可插拔 LLM adapter（即使首版仅 stub）

---

### M4 · 安全与 BYOK 🔐 原型启动

**目标：** 用户自带 API Key 时，密钥与数据不出用户边界；满足最低安全基线后再讨论对外使用。

**已有原型：**
- 模型 provider 与搜索 provider 的后端状态接口，状态响应不返回原始 API Key
- evidence search 可通过 deterministic provider 跑通，未来可替换为私有 `http-json` 搜索网关
- `GET /projects/:id/provider-readiness` 已将真实 provider rollout 的剩余差距显式化，包含 provider control policy、allowlist、预算/限流、Agent 工具授权、retry policy、circuit-breaker policy、本地 secret-vault status、provider usage/cost ledger、provider-backed evidence source-safety summary，MVP readiness 的 `production-real-providers` blocker 会指向该路由
- `.env.example` 记录模型/搜索 provider 配置边界，默认关闭搜索 provider
- `secretRedaction.js` 已覆盖 provider 状态/错误、evidence source、Agent submission/sourceRefs、review comments、task sourceRefs、workspace artifact draft 与 ledger payload 的原型级写入前脱敏
- `secretVault.js` 已提供本地 AES-GCM envelope vault 契约，可通过 `SECRET_VAULT_ENABLED` / `SECRET_VAULT_KEY` 启用；Provider Readiness 与 Security Boundary 会展示 vault ready、encrypted record count 与 raw secret record count，但生产仍需托管 KMS/Secret Manager、轮换、撤销与访问审计
- `npm run agents:product-team` 会注入假密钥并扫描 file store 与 workspace artifact files，验证 BYOK 风格秘密不会以原文持久化
- `GET /projects/:id/security-boundary` 会导出路由策略、敏感字段清单、provider 状态边界、脱敏扫描摘要和生产安全 blocker，并由 `npm run agents:product-team` 验证
- `AGENT_ACCESS_SIGNING_SECRET` 可开启原型级签名身份头校验，强制访问模式会先验签再执行角色策略；这降低本地/内测部署中的头部伪造风险，但仍不是正式身份系统
- `AGENT_ACCESS_REPLAY_PROTECTION` 可要求签名请求携带 `x-hofs-request-id`，本地文件后端会在签名有效期内持久记录已接受的 request id，并在 API 重启后继续拒绝重复 request id；生产多实例仍需要共享 replay store
- `AGENT_ACCESS_AUDIT_FAIL_CLOSED` 可要求强制访问在审计写入失败时直接拒绝；生产仍需要集中不可变审计、告警和恢复流程
- `GET|PUT /projects/:id/membership-policy` 可把 `project-membership-policy/v1` 存为项目状态，包含 manager/security/observer/runtime/Agent/Reviewer 授权、Agent runtime 绑定、撤销列表、revision 和事件账本审计；`requireProjectMembership` 会在角色/签名之后读取该持久策略，拒绝不属于该项目或已撤销的 manager、Agent runtime 或 Reviewer；生产仍需要数据库成员表、邀请/撤销流程和行级权限
- `GET|POST /projects/:id/identity-sessions` 可签发、列出和撤销本地 `identity-session/v1` 运行凭证；token 只在签发响应中返回一次，项目状态只保存 token hash/checksum/status/expiry/revocation proof，`x-hofs-session-token` 可在 MVP 验收中替代重复签名头访问项目 proof route。会话使用会进入 security access audit、backend audit stream、event ledger、persistence snapshot 和 Manager Ready Package 安全边界摘要；生产仍需要正式 IdP、持久 session store、服务身份签发、轮换、audience binding、集中审计和多实例 replay 防护

**尚未完成：**
- API Key 加密存储与 scope 隔离
- 沙箱化 tool / file 访问
- Prompt 注入与跨 Agent 污染防护
- 生产级审计日志、密钥生命周期管理与 redaction bypass 安全评审
- 依赖与供应链扫描

> **在此阶段完成前，请勿将本项目用于任何含敏感信息的场景。**

---

### M5 · 公开发布 ⏳ 未开始

**目标：** 文档、License、安装路径、升级策略齐备，Community 可安全试用。

**前置条件：** M1–M4 全部达标 + 明确 License。

---

## 四、当前所处阶段（结论）

```
┌─────────────────────────────────────────────────────────┐
│  你现在在这里：M1（Skill 设计）深度推进中                │
│              M2（协作机制）与 M3（Runtime）为并行骨架    │
│              M4（安全）与 M5（发布）尚未启动             │
└─────────────────────────────────────────────────────────┘
```

**三条并行研发主线（用户可见优先级）：**

| 优先级 | 主线 | 状态 | 说明 |
|--------|------|------|------|
| P0 | 每个人单独的 Skill 设计 | **进行中** | 人物包质量决定一切上层行为 |
| P1 | Agent 协作机制 | **部分完成** | 协议已有，需与 Skill + LLM 联调 |
| P2 | 整个运行算法 | **原型级** | 演示可用，生产不可用 |

---

## 五、本地运行 ≠ 可以使用

README 中的 Quick Start 仅用于 **开发者本地预览 UI 与跑验证脚本**：

```bash
npm install
npm run dev          # 预览界面
npm run skills:check # 校验 Skill 包
npm run agents:scenario
```

这 **不表示** 产品已可用于：
- 真实项目管理
- 团队日常协作
- 接入生产 API Key 处理业务数据

---

## 六、Contributor 快速入口

| 想贡献… | 从这里开始 |
|---------|------------|
| 人物 Skill | [`人物Skill系统.md`](人物Skill系统.md) → `skills/hall-of-fame-personas/` |
| Agent 协议 | [`src/agents/README.md`](src/agents/README.md) |
| 产品全貌 | [`PRD.md`](PRD.md) |
| 架构审计 | [`src/agents/ARCHITECTURE_AUDIT.md`](src/agents/ARCHITECTURE_AUDIT.md) |
| 提 Issue / PR | 请先说明针对 M1 / M2 / M3 哪一阶段 |

---

## 七、变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-27 | 补齐私有 adapter gateway 项目级预检：Manager Ready Package / deployment preflight / API / Harness 可以读取 live health、state 与 capability proof，仍保持 production cutover 阻塞 |
| 2026-06-27 | Added `project-evidence-export-workflow/v1` plus local `project-evidence-export-package/v1` receipt for private-pilot evidence handoff governance across API, Manager Ready Package, UI, Flow Graph, Proof Map, access policy, persistence snapshot, and product-team Harness while keeping production export blocked |
| 2026-06-27 | Added `evidence-quality-audit/v1` as the Manager decision-readiness audit for evidence rows/source quality/source safety/proof routes across API, Manager Ready Package, archive manifest, UI, access policy, product-team Harness, and docs; production search still requires real gateway, calibrated source policy, and managed audit storage |
| 2026-06-27 | Added `evidence-source-review-workflow/v1` as the reviewer-visible source governance workflow across API, Manager Ready Package, archive manifest, launch evidence routes, UI, access policy, product-team Harness, and docs; production still requires human source-review approval policy, calibrated quality policy, immutable source snapshots, and managed reviewer/provider audit storage |
| 2026-06-27 | Added `project-evidence-archive/v1` as the Manager/customer handoff proof bundle across API, Manager Ready Package manifest summary, UI, access policy, product-team Harness, and docs; production export/download controls remain blocked |
| 2026-06-27 | 补齐本地 identity-session / runtime credential 合同：签发、使用、撤销、审计、持久化、迁移种子和 Manager 安全边界证明面，仍保持生产身份系统阻塞可见 |
| 2026-05-31 | 首版路线图：明确 Pre-alpha 状态，锁定 M1 为当前主战场 |

---

## English summary

**Hall of Fame Studio is pre-alpha and not safe for production use.** Security guarantees are not in place. Active development focuses on (1) per-persona skill packages, (2) multi-agent collaboration protocols, and (3) the autonomous runtime algorithm — currently between Phase 1 and Phase 2. See sections above for milestone details and contributor entry points.
