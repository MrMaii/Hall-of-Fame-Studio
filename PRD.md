# AI 虚拟项目组平台产品需求文档（PRD）最终定稿版

## 一、文档概述

### 1.1 项目名称

**AI Virtual Team** —— 全 AI 驱动虚拟项目组协作平台

### 1.2 核心定位

一款开源可私有化部署、采用 **BYOK（By Your Own Key）** 自研 API 密钥运行模式的 AI 协作工具，核心为用户打造纯 AI 雇员组成的虚拟项目组，实现从项目立项、分工、执行到进度追踪、迭代修改的全流程 AI 自主化协作，所有 AI 雇员具备独立思考、主动讨论、自主工作能力。

### 1.3 技术模式

- 开源免费，支持用户本地 / 服务器私有化部署
- 无平台内置 API 服务，采用 BYOK 模式：用户填写自有大模型 API 密钥即可运行
- 所有数据、对话、项目记录本地存储，无云端上传，保障用户隐私

### 1.4 文档说明

本 PRD 仅描述产品功能、交互流程、核心规则，不绑定任何具体现实人物，AI 雇员以领域能力标签做差异化区分，所有案例均为功能场景说明。

### 1.5 验证场景说明

本产品定位为通用的 AI 产品团队协作系统，不为某一个垂直场景单独定制。Research Project 可作为早期验收样例，因为它同时包含需求澄清、信息搜集、证据判断、头脑风暴、写作、评审、群聊协作、节点提交和最终交付等典型产品团队能力。

因此，Research Project 的作用是测试系统能否完整跑通一个复杂产品工作流，而不是把产品限定为论文写作或研究工具。

该验收样例必须覆盖通用产品团队的核心闭环：Agent 主动搜集信息并形成证据记录，基于证据提交阶段性产物，Reviewer 对产物提出修改意见或确认通过，修改后的产物继续进入最终交付。上述动作都应进入项目记录、群聊、流程图和可追溯证明链，而不是只停留在聊天文本中。

产品必须区分三种就绪状态：一是通用产品团队闭环是否已经达到本地内测 / MVP 演示标准，二是系统是否可以进入受控私有试点，三是系统是否已经满足正式生产上线要求。MVP 就绪可以基于会议治理、角色自荐、脑暴、证据判断、提交、评审、修订、最终交付、后端 worker 和证明链路来判断；私有试点上线包必须聚合这些证据并给出 private-pilot go/no-go；私有试点真正放行还必须经过 Manager 与 security-admin 的上线审批记录；生产上线仍必须单独显示密钥保管、权限、安全边界、托管持久化、数据库迁移计划与 dry-run 验证、数据库 adapter cutover 验证、队列调度、真实 provider、监控恢复、operations-owner 生产审批等阻塞项。

---

## 二、核心用户完整使用流程

### 2.1 第一步：创建虚拟项目组

1. 用户进入平台，点击新建项目组
2. 自定义填写项目组名称，可补充项目简介（非必填）
3. 项目组创建完成，进入项目组专属控制台

### 2.2 第二步：AI 雇员市场招聘

1. 从项目组控制台进入雇员招聘市场
2. 市场按专业能力领域分类展示 AI 雇员（如商业管理、产品设计、技术研发、视觉设计、品牌内容、项目统筹等）
3. 每个 AI 雇员展示：独立人设标签、核心擅长领域、专业能力描述、独立行事风格
4. 用户自主选择、一键雇佣 AI 雇员，已雇佣雇员自动纳入当前项目组员工列表
5. 支持随时返回市场增聘、解聘 AI 雇员

### 2.3 第三步：召开项目立项会议（核心流程）

#### 2.3.1 会议启动

用户发起第一次项目立项会议，默认全员参会，支持手动勾选参会 AI 雇员。

#### 2.3.2 会议形式

采用圆桌会议可视化界面，所有参会 AI 雇员以独立角色展示，模拟真实圆桌讨论场景。

#### 2.3.3 立项会议完整流程

**需求确认环节**

- AI 雇员主动向用户发起提问，集体确认项目核心目标：明确要做的产品 / 项目核心定位、核心诉求
- 各 AI 雇员按领域，轮流提出抽象化产品问题，进一步细化需求（如目标受众、核心价值、落地方向、边界范围等）
- 用户逐一回复解答，直至 AI 雇员完全明确项目需求

**分工协商环节**

- 需求确认完毕后，AI 雇员主动向用户询问自身分工安排
- 用户下达分工指令后，AI 雇员基于自身能力，主动提出分工调整意见（如跨领域配合、分工合理性优化、权责补充等）
- 用户最终确认分工方案，所有 AI 雇员达成一致

**立项定稿**

- 会议达成全部共识，项目正式立项
- 系统自动生成本次立项会议核心结论、分工方案，同步存入项目纪要

### 2.4 第四步：AI 自主执行项目工作

1. 立项完成后，进入项目进度专属页面
2. 所有 AI 雇员按照立项会议确定的分工、需求，自主开展工作，无需用户实时指令
3. 进度页实时展示整体项目推进进度、各 AI 雇员工作状态、当前完成节点
4. 系统自动记录每日工作内容，每个 AI 雇员自动生成每日工作汇报，同步至项目日志
5. 项目执行期间，AI 雇员仅在遇到核心决策问题时，主动向用户提问确认
6. AI 雇员可按规范提交阶段性产出，例如研究报告、证据包、决策建议、风险复核、执行计划等，提交后作为流程图节点供用户查看、比较、复核或退回修改
7. AI 雇员可在项目流程中主动表达自身适合承担某项工作的理由，例如角色自荐、Leader 竞选、评审请求、产出提交说明等，该类“自我说明”应作为可追溯协作证据进入流程图或项目记录
8. AI 雇员可提交信息搜集与证据记录，包括搜索问题、来源、证据质量、结论摘要和关联任务，用户可在任务证据、流程图和项目记录中查看
9. Reviewer 可对 Agent 提交的产物进行正式评审，支持“要求修改”和“确认通过”两类基础结果；评审意见、修改要求、最终通过记录都应成为可追溯节点

### 2.5 第五步：项目迭代修改（会议制修改规则）

1. 项目执行过程中，所有修改、需求调整、方向变更，均需通过召开会议完成
2. 用户可自主选择参会 AI 雇员范围（全员 / 指定人员）
3. **会议流程**：用户提出修改诉求 → AI 雇员讨论反馈 → 确认修改方案 → 执行修改
4. 会议结束后，系统自动总结本次会议核心要点、修改指令、执行要求，展示在项目控制台核心区域，同步更新至项目纪要
5. AI 雇员根据会议结论，自主调整后续工作内容

### 2.6 项目闭环

项目完成后，AI 雇员提交最终成果总结，生成完整项目日志、会议纪要、工作记录，用户可查看、导出全部项目资料。

---

## 三、核心产品规则

| 规则 | 说明 |
|------|------|
| **AI 雇员独立性** | 所有 AI 雇员为独立思考个体，具备主动讨论、主动提问、提出意见、自主工作的能力，非被动指令执行工具 |
| **修改唯一规则** | 禁止零散对话式修改，所有项目变更必须通过会议形式发起，确保协作流程规范化 |
| **会议纪要留存** | 每一次会议（立项会、迭代会、协调会），系统均自动生成核心总结，永久留存 |
| **工作可追溯** | 项目全流程留痕，包含所有会议记录、AI 每日工作汇报、进度变更记录、分工调整记录，用户可随时查阅 |
| **通用产物节点** | Agent 产出必须以通用产品团队 artifact 类型提交为流程图节点，至少覆盖 discovery-report、brainstorm-board、evidence-packet、product-brief、decision-proposal、risk-review、revision-note、implementation-plan 和 final-deliverable；Research Project 只用于验证这些通用节点，不得形成论文专用协议 |
| **后端产物草稿生成** | Agent 必须能基于项目上下文、任务、证据搜索、前序提交与评审意见生成 `agent-artifact-draft/v1` 草稿；草稿可被直接提交为标准 Agent submission，并进入流程图、任务证据、群聊、timeline、事件账本、工作区文件和 Proof Map。Manager Dashboard、Agent Dashboard、归档包和持久化迁移行必须保留草稿来源、draft id、checksum、本地/模型生成状态、proof context 与 `artifact-draft-quality/v1` 质量 gate。首版验收必须同时覆盖本地 fallback 生成器和 provider policy 约束下的 deterministic model-backed draft；模型草稿必须标记人工复核要求，并在 Provider Readiness 中显示 model draft quality / human review gate。真实 LLM 生产生成必须走 BYOK/provider policy、校准后的质量审核、限流预算和事故控制 |
| **产物质量审计** | Manager Ready Package 必须展示 `artifact-quality-audit/v1`，后端必须通过 `GET /projects/:id/artifact-quality-audit` 暴露同一份合同。该合同必须审计所有 Agent submissions 的通用 artifact 类型覆盖、标题/摘要/正文完整性、chat/timeline/event/artifact proof、评审/修订/最终交付闭环、生成草稿质量状态、脱敏结果、local gate、production controls 和 checksum。它用于回答“这些产品团队产物是否足以进入私有试点交付”，不得因为本地 deterministic rubric 通过而宣称生产级内容质量评估已完成 |
| **修改闭环可追溯** | Reviewer 要求修改后，revision-note / final-deliverable 必须关联原 review、被修订 submission、被替换 draft，并在流程图、任务证据和事件账本中可追溯 |
| **证据质量判断** | Agent 的信息搜集不能只保存链接列表，必须记录每个来源的质量信号、质量分、整体 evidence judgement，并在 Reviewer、流程图和任务证据中可查看 |
| **证据来源安全判断** | Agent 的信息搜集来源必须经过通用 source-safety screening，记录危险协议/私网地址/prompt-injection/疑似密钥等安全信号、sourceSafetyLevel、sourceSafetyScore 和整包 sourceSafetySummary；Manager Ready Package、流程图、任务证据、Proof Map 与 provider readiness 必须可查看这些判断 |

---

## 四、技术核心要求

- **生产上线审计包**：Manager Ready Package 必须展示 `production-launch-audit/v1`，后端必须通过 `GET /projects/:id/production-launch-audit` 暴露同一份合同。该合同必须聚合 MVP readiness、`pilot-launch-readiness/v1`、`deployment-preflight/v1`、security boundary、provider readiness、operations readiness、项目证据 handoff summary、证据路由、生产阻塞清单和 checksum，输出 `privatePilotDecision`、`productionDecision`、`readyForPrivatePilot`、`readyForProduction`、private-pilot gates、private-pilot handoff gates、production gates、audit-integrity gates、production blockers 和 nextShortestPath。完整本地/私有试点证据齐备时可返回 `privatePilotDecision: go`；如果客户 handoff package 尚未完成 download-audit，nextShortestPath 必须先指向 `private-pilot-handoff`，完成后才回到 `production-hardening`。在真实受管身份、数据库、队列、KMS、Provider 事故处理、集中审计和运维控制补齐前，必须保持 `productionDecision: no-go` 与 `readyForProduction: false`
- **生产上线缺口登记表**：Manager Ready Package 必须展示 `production-launch-gap-register/v1`，后端必须通过 `GET /projects/:id/production-launch-gap-register` 暴露同一份合同。该合同必须把 `production-launch-audit/v1`、deployment preflight、production operations readiness、provider readiness、evidence custody、artifact quality 和 submission review governance 中的正式生产 blocker 归并为去重的 gap rows，逐项展示 domain、owner、severity、action、apiPath、proof ids、timeline/event ids、upstream checksums、nextAction 和 checksum。它必须写入 Manager Flow Graph 的 production gap 节点、Readiness Proof Map `productionLaunchGapRoutes`、Security Boundary route policy、Manager UI 和产品团队 Harness。它只能作为正式上线差距与责任分配清单，必须保持 `readyForProduction: false`，直到真实受管身份、数据库、队列、KMS、Provider、集中审计、observability、incident/restore 和生产审批证据都闭合
- **生产上线控制中心**：Manager Ready Package 必须展示 `production-launch-control-center/v1`，后端必须通过 `GET /projects/:id/production-launch-control-center` 暴露同一份只读合同。该合同必须把 production launch audit、production launch gap register、private-pilot go-live readiness、production operations receipts、production deployment receipts、production security receipts、production provider receipts、launch approvals、deployment preflight、provider readiness、security boundary、evidence custody 和 artifact quality 汇总为 control rows、blocked rows、owner rows、stage rows、nextAction、proof ids、timeline/event ids、upstream checksums 和 checksum。它必须写入 Manager Flow Graph 的 production launch control center 决策节点、Readiness Proof Map `productionLaunchControlCenterRoutes`、Security Boundary route policy、Manager UI 和产品团队 Harness。它只能作为 public-production 发布办公室视图，必须保持 `productionDecision: no-go` 与 `readyForProduction: false`，直到所有真实生产控制、生产审批和 launch audit 都闭合
- **生产运维控制就绪度**：Manager Ready Package 必须展示 `production-operations-readiness/v1`，后端必须通过 `GET /projects/:id/production-operations-readiness` 暴露同一份合同。该合同必须聚合私有试点客户验收、post-launch health、operations incident drill、security audit stream、provider eval replay、persistence adapter dry-run、worker queue adapter dry-run 和 production launch audit，输出 local proof gates、production control gates、requiredProductionControls、observabilityPlan、onCallPlan、incidentPlan、managedInfrastructure、nextShortestPath 和 checksum。完整私有试点证据齐备时可返回 `readyForPrivatePilotOperations: true`；但在集中 logs/metrics/traces、alert routing、on-call owner、managed incident system、真实 restore drill、集中 audit retention、受管数据库/队列 cutover approval 补齐前，必须保持 `readyForProductionOperations: false` 与 `readyForProduction: false`
- **生产运维控制凭证**：Manager Ready Package 必须展示 `production-operations-control-receipt-workflow/v1`，后端必须通过 `GET|POST /projects/:id/production-operations-control-receipts` 暴露同一份合同。`GET` 必须展示 required control ids、verified/missing controls、latest receipt、proof ids、timeline/event ids 和 checksum；`POST` 只能允许 security-admin 或 operations-owner 记录 `production-operations-control-receipt/v1`，并为 centralized logs、metrics、traces、alert routing、on-call ownership、managed incident system、real restore drill、managed persistence cutover、managed worker queue cutover、centralized audit retention 保存证据 id/route/checksum、操作者、原因和脱敏详情。凭证必须写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy、Manager UI 和 `production_operations_control_receipts` persistence rows。全部控制凭证通过后可以让 `production-operations-readiness/v1` 返回 `readyForProductionOperations: true`，但不得绕过更大的 `production-launch-audit/v1`；如果身份、KMS、Provider、部署或其他生产 gate 未完成，整体生产上线仍必须 `no-go`
- **生产部署控制凭证**：Manager Ready Package 必须展示 `production-deployment-control-receipt-workflow/v1`，后端必须通过 `GET|POST /projects/:id/production-deployment-control-receipts` 暴露同一份合同。`GET` 必须展示 enforced access、replay protection、audit fail-closed、scheduler autostart、real persistence adapter、managed evidence custody、real queue adapter、environment promotion audit、rollback/smoke test、deployment change approval、production domain/TLS 等 required control ids、verified/missing controls、latest receipt、proof ids、timeline/event ids 和 checksum；`POST` 只能允许 runtime-platform、operations-owner 或 security-admin 记录 `production-deployment-control-receipt/v1`，并保存每项控制的证据 id/route/checksum、操作者、原因、完成时间和脱敏详情。凭证必须写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy、Manager UI 和 `production_deployment_control_receipts` persistence rows。全部控制凭证通过后可以让 deployment 域返回 ready，但不得绕过更大的 `production-launch-audit/v1` 或 `production-launch-control-center/v1`
- **生产安全控制凭证**：Manager Ready Package 必须展示 `production-security-control-receipt-workflow/v1`，后端必须通过 `GET|POST /projects/:id/production-security-control-receipts` 暴露同一份合同。`GET` 必须展示 managed identity provider、service identity boundary、managed KMS/Secret Manager、database-backed RBAC、centralized security audit、session replay hardening 等 required control ids、verified/missing controls、latest receipt、proof ids、timeline/event ids 和 checksum；`POST` 只能允许 security-admin 记录 `production-security-control-receipt/v1`，并保存每项控制的证据 id/route/checksum、操作者、原因、完成时间和脱敏详情。凭证必须写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy、Manager UI 和 `production_security_control_receipts` persistence rows。全部控制凭证通过后可以让 Security Boundary 的生产安全域返回 ready，但不得绕过更大的 `production-launch-audit/v1` 或 `production-launch-control-center/v1`；如果 Provider、部署、审批、运维或其他生产 gate 未完成，整体生产上线仍必须 `no-go`
- **私有试点上线总控视图**：Manager Ready Package 必须展示 `private-pilot-go-live-readiness/v1`，后端必须通过 `GET /projects/:id/private-pilot-go-live-readiness` 暴露同一份合同。该合同必须把通用产品团队交付证明、launch approvals、evidence handoff package、provider eval、deployment/operations/security preflight、private-pilot release candidate、launch run、post-launch health、customer acceptance 和 production operations hardening receipts 汇总为 stage rows、active phase、next action、proof ids、timeline/event ids、backend routes 和 checksum。它必须写入 Manager Flow Graph 的 go-live 聚合节点、Readiness Proof Map `privatePilotGoLiveRoutes`、Security Boundary route policy、Manager UI 和产品团队 Harness。它可以证明私有试点 go-live 与 customer acceptance 的本地状态，但不得在 `production-launch-audit/v1` 仍为 no-go 时宣称 public production 已可上线
- **提交评审闭环工作流**：Manager Ready Package 必须展示 `submission-review-workflow/v1`，后端必须通过 `GET /projects/:id/submission-review-workflow` 暴露同一份合同。该合同必须聚合通用 Agent submissions、submission reviews、requested changes、revision responses、final-deliverable acceptance、proof routes、timeline/event ids 和 checksum，输出 review rounds、open change requests、revision response count、accepted final deliverable count、local gates 与 production review governance blocker。它必须写入或引用 Manager Flow Graph 聚合节点、Readiness Proof Map `submissionReviewWorkflowRoutes`、Security Boundary route policy、Manager UI 和产品团队 Harness。该合同用于证明草稿评审、修改请求、修订、最终交付验收已经闭环，但不得在缺少校准评审策略、Reviewer 身份生命周期、不可变输出审计存储和客户验收阈值时宣称生产级 review governance 已完成
- **项目证据归档包**：Manager Ready Package 必须展示 `project-evidence-archive/v1`，后端必须通过 `GET /projects/:id/project-evidence-archive` 暴露同一份合同。该合同必须以脱敏方式聚合项目状态、会议/群聊 transcript、Agent submissions、最终交付物、evidence searches、submission reviews、revision lineage、Manager Flow Graph、Readiness Proof Map、timeline、event ledger、readiness 摘要、persistence 摘要和 worker recovery 摘要，并为每个 manifest entry 提供 checksum 与完整性 gate。它用于私有试点/客户验收 handoff，不得在仅有本地导出审批、但缺少加密对象存储、保留执行、下载审计、水印和数据驻留控制时宣称为生产级导出系统
- **证据质量审计包**：Manager Ready Package 必须展示 `evidence-quality-audit/v1`，后端必须通过 `GET /projects/:id/evidence-quality-audit` 暴露同一份合同。该合同必须聚合 evidence searches、source quality signals、source-safety screening、provider provenance、Readiness Proof Map 路由、decision gates、production controls 和 checksum，输出 `readyForDecision`、`readyForLocalPilot`、`readyForProduction: false`、每条 evidence row、每个 source row、failed decision gates 和 required production controls。它用于回答“当前证据是否足以支撑产品决策”，不得因为本地 deterministic provider 或原型评分通过而宣称生产级证据审计已经完成
- **证据来源审核工作流**：Manager Ready Package 必须展示 `evidence-source-review-workflow/v1`，后端必须通过 `GET|POST /projects/:id/evidence-source-review-workflow` 暴露同一份合同。`GET` 必须从 evidence quality audit 的 source rows 派生 reviewer-visible source review items，展示 reviewer、source quality/source-safety signals、local `evidence-source-snapshot/v1`、`evidence-provider-receipt/v1`、review queue、latest source decision、proof route、decision gates、checksum 和 required production controls；`POST` 必须允许 Reviewer 提交 `evidence-source-review/v1` 决定，将来源批准、驳回、隔离或补证要求写入群聊、timeline、event ledger、Manager Flow Graph、Task Evidence、Readiness Proof Map、Project Evidence Archive 和 persistence snapshot。它可以证明本地/私有试点的来源审核队列、Reviewer 决定、来源快照和 provider receipt 都可见、可追溯，但在人工来源审核策略、校准后的来源质量策略、托管不可变 source/provider receipt 存储和 reviewer audit 补齐前必须保持 `readyForProduction: false`
- **证据保管就绪包**：Manager Ready Package 必须展示 `evidence-custody-readiness/v1`，后端必须通过 `GET /projects/:id/evidence-custody-readiness` 暴露同一份合同。该合同必须把 `evidence-source-snapshot/v1`、`evidence-provider-receipt/v1` 和 `evidence-source-review/v1` 决定汇总为可审计 custody rows，展示 source/provider/reviewer checksum、proof route、timeline/event proof、Manager Flow Graph custody 节点、Readiness Proof Map custody route、Project Evidence Archive manifest coverage、local custody gates 和 required production controls。它可以证明私有试点下证据来源、provider 调用和 Reviewer 决定已经有本地保管链，但不得在缺少托管不可变对象存储、签名访问、保留/删除任务和集中 custody audit 时宣称生产级证据保管完成
- **项目证据导出治理**：Manager Ready Package 必须展示 `project-evidence-export-workflow/v1`，后端必须通过 `GET|POST /projects/:id/project-evidence-exports` 暴露同一份合同。Manager 可以提交私有试点证据 handoff 请求，系统必须生成 `project-evidence-export/v1` 记录并锁定该请求对应的归档包 checksum；Manager 与 security-admin 都批准后才允许显示 `readyForPrivatePilotHandoff: true`。导出治理记录必须包含 mode、action/decision、actorRole、actorId、reason、retentionDays、expiresAt、dataResidencyRegion、downloadAuditRequired、archiveChecksum 和 checksum，并写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map 与 persistence snapshot 的 `project_evidence_exports` 表。审批完成后，系统必须要求一次 download-audit 记录，才允许返回本地私有试点 `project-evidence-export-package/v1` 描述符；该描述符必须包含归档 manifest checksum、请求 checksum、当前归档 checksum、水印元数据、保留期/数据驻留元数据、package gates 和下载审计收据，并保持 `downloadUrlIssued: false`。正式生产导出仍必须保持 `readyForProductionExport: false`，直到真实加密对象存储、签名限时下载 URL、水印执行、保留期删除任务、集中下载审计和数据驻留控制补齐
- **上线审批与变更管理**：Manager Ready Package 必须展示 `launch-approval-workflow/v1`，后端必须通过 `GET|POST /projects/:id/launch-approvals` 暴露同一份合同。Manager 与 security-admin 必须分别提交 `launch-approval/v1` 记录后，私有试点上线审计才可以返回 private-pilot `go`；生产上线还必须额外要求 operations-owner，并在真实生产控制补齐前保持 production `no-go`。审批记录必须写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map 和 persistence snapshot 的 `launch_approvals` 表，并保留 mode、decision、approverRole、approverId、reason、checksum 与关联审计 checksum
- **开源属性**：项目源码完全开源，支持 GitHub 公开仓库部署，允许用户二次修改、分发
- **私有化部署**：支持本地、云服务器一键部署，无强制云端依赖
- **BYOK 运行模式**：不提供内置模型服务，用户需配置自有大模型 API 密钥，所有 AI 交互依赖用户自有密钥计费
- **Provider 上线闸门**：Manager Ready Package 必须展示模型/搜索 provider 的本地可用性与生产阻塞项；后端必须通过 `GET /projects/:id/provider-readiness` 暴露 `provider-readiness/v1`，至少包含脱敏后的模型/搜索状态、deterministic 验证 provider、本地 evidence-search provider provenance、checksummed source snapshots、provider receipts、provider proof routes、红线级泄密扫描、provider control policy、allowlist、预算/限流、Agent 工具授权、provider retry policy、provider circuit-breaker policy、本地 secret-vault status、provider usage/cost ledger，以及 provider-backed evidence 的来源安全审查摘要；该闸门可以证明可进入本地 MVP 内测，但在生产级失败隔离、托管 KMS/密钥金库、真实 provider 事故处理、托管不可变 source/provider receipt 存储和托管审计存储补齐前必须保持 `readyForProduction: false`
- **Provider 受控运行计划**：Manager Ready Package 必须展示 `provider-controlled-run/v1`，后端必须通过 `GET /projects/:id/provider-controlled-run` 暴露同一份合同。该合同不得直接发起 provider 调用，而是对私有试点可能使用的 provider health check、kickoff/intent 模型支持、model artifact draft、evidence search 等操作进行 policy dry-run，逐项展示 allowlist、Agent tool grant、预算余量、小时请求余量、retry/circuit 状态、usage-ledger proof、人审边界、证据治理、脱敏状态和 production controls。它用于回答“真实 BYOK 接进来后，哪些操作可以被安全放进一次受控私有试点运行”，不得因为本地 deterministic provider 通过而宣称生产级 provider rollout 已完成
- **Provider 影子评估运行**：Manager Ready Package 必须展示 `provider-eval-run-workflow/v1`，后端必须通过 `GET|POST /projects/:id/provider-eval-runs` 暴露同一份工作流。`GET` 用于查看是否已有 provider eval 影子回放收据；`POST` 只能记录 no-call shadow replay，必须把 `provider-controlled-run/v1` 中的关键模型/搜索操作与已有 usage-ledger proof 绑定，至少覆盖 `model:artifact-draft` 和 `search:evidence`，并写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy 和 persistence snapshot 的 `provider_eval_runs` 行。该工作流可以证明私有试点 provider eval 演练就绪，但不得在缺少真实 provider eval datasets、托管 eval 存储、集中成本告警、事故 runbook 和校准发布策略前宣称生产级 provider rollout 完成
- **Provider 生产控制凭证**：Manager Ready Package 必须展示 `production-provider-control-receipt-workflow/v1`，后端必须通过 `GET|POST /projects/:id/production-provider-control-receipts` 暴露同一份工作流。`GET` 必须展示 provider rollout 所需的 required control ids、verified/missing controls、latest receipt、proof ids、timeline/event ids、backend routes 和 checksum；`POST` 只能允许 runtime-platform 或 security-admin 记录 `production-provider-control-receipt/v1`，并为 provider allowlist、预算/限流、Agent 工具授权、retry/circuit breaker、provider audit/cost ledger、encrypted secret vault、source safety review、source snapshot/provider receipt、model-output quality review、real provider eval、managed provider audit/eval storage、centralized cost alerting、calibrated release policy 和 incident runbook 保存证据 id/route/checksum、操作者、原因、完成时间和脱敏详情。凭证必须写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy、Manager UI 和 `production_provider_control_receipts` persistence rows。全部控制凭证通过后可以让 provider rollout 域返回 production-provider ready，但不得绕过更大的 `production-launch-audit/v1` 或 `production-launch-control-center/v1`；如果部署、审批、运维、安全或其他生产 gate 未完成，整体生产上线仍必须 `no-go`
- **私有试点发布候选凭证**：Manager Ready Package 必须展示 `private-pilot-release-candidate-workflow/v1`，后端必须通过 `GET|POST /projects/:id/private-pilot-release-candidates` 暴露同一份工作流。`GET` 必须显示当前是否具备冻结候选的条件；`POST` 只能在生产上线审计私有试点 gate、私有试点 launch readiness、Manager/security-admin launch approvals、证据 handoff package download-audit、项目证据归档、provider eval shadow replay、deployment preflight、operations readiness 和 security route coverage 都满足时，记录 `private-pilot-release-candidate/v1`。该凭证必须冻结 Manager Ready Package、MVP/pilot/deployment readiness、production launch audit、project evidence archive/export package、provider eval run、operations、persistence adapter 和 worker queue adapter checksum，并写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy 与 persistence snapshot 的 `private_pilot_release_candidates` 行。该凭证只能表示“可进入私有试点发布候选”，不得在真实受管身份、数据库、队列、KMS、Provider eval、集中审计、部署和运维控制补齐前宣称正式生产可用
- **私有试点启动运行收据**：Manager Ready Package 必须展示 `private-pilot-launch-run-workflow/v1`，后端必须通过 `GET|POST /projects/:id/private-pilot-launch-runs` 暴露同一份工作流。`GET` 必须显示当前是否可以从已冻结的 release candidate 启动受控私有试点；`POST` 只能在 release candidate ready、production launch audit 私有试点仍为 go、证据 handoff package 仍已审计、项目归档/provider eval/proof surfaces/deployment preflight/operations runbook/incident drill/security boundary 仍 ready 时，记录 `private-pilot-launch-run/v1`。该收据必须绑定 release candidate id/checksum，并冻结 launch audit、证据包、provider eval、deployment、operations、persistence adapter 和 queue adapter checksum，写入 timeline、event ledger、Manager Flow Graph、Readiness Proof Map、Security Boundary route policy 与 persistence snapshot 的 `private_pilot_launch_runs` 行。该收据只能表示“受控私有试点已启动/可启动”，不得替代正式生产 go-live 证书
- **私有试点启动后健康收据**：Manager Ready Package 必须展示 `private-pilot-launch-health-check-workflow/v1`，后端必须通过 `GET|POST /projects/:id/private-pilot-launch-health-checks` 暴露同一份工作流。`GET` 必须显示启动收据之后 operations、worker queue adapter、persistence adapter、security boundary、provider eval、证据归档、Flow Graph 和 Proof Map 是否仍然健康；`POST` 只能在阻塞级 gate 通过时记录 `private-pilot-launch-health-check/v1`。该收据必须绑定 launch run id/checksum，并冻结 operations/security/provider/evidence/persistence/queue health checksum，写入 timeline、event ledger、Manager Flow Graph monitoring node、Readiness Proof Map、Security Boundary route policy 与 persistence snapshot 的 `private_pilot_launch_health_checks` 行。该收据只能表示“受控私有试点启动后可监控”，不得替代正式生产 observability、on-call、incident system 或 restore drill 证书
- **私有试点客户验收报告**：Manager Ready Package 必须展示 `private-pilot-acceptance-report-workflow/v1`，后端必须通过 `GET|POST /projects/:id/private-pilot-acceptance-reports` 暴露同一份工作流。`GET` 必须显示 release candidate、launch run、post-launch health、证据 handoff package、通用产品团队交付证明、operations/security/provider proof、Flow Graph 与 Proof Map 是否足以形成客户可验收闭环；`POST` 只能在阻塞级 gate 通过时记录 `private-pilot-acceptance-report/v1`。该报告必须冻结 release/launch/health/evidence/Flow Graph/Proof Map checksum，绑定 launch run 与 health receipt，写入 timeline、event ledger、Manager Flow Graph decision node、Readiness Proof Map、Security Boundary route policy 与 persistence snapshot 的 `private_pilot_acceptance_reports` 行。该报告只能表示“客户私有试点验收 ready/已记录”，不得替代正式生产上线证书、SLA、on-call、incident system、托管身份/数据库/队列/KMS 或 restore drill 证据
- **私有试点上线包**：Manager Ready Package 必须展示 `pilot-launch-readiness/v1`，后端必须通过 `GET /projects/:id/pilot-launch-readiness` 暴露同一份合同。该合同必须聚合 MVP readiness、proof routes、流程图、提交/证据/评审、security boundary、provider readiness、managed persistence adapter dry-run、worker queue adapter dry-run、operations readiness 和 incident drill，输出 `privatePilotDecision`、`productionDecision`、checksummed launch packet、evidence routes、failed gates 和 production blockers；当本地试点证据齐备时可以返回 private-pilot `go`，但在真实生产控制补齐前 `productionDecision` 必须保持 `no-go`
- **部署前预检**：Manager Ready Package 必须展示 `deployment-preflight/v1`，后端必须通过 `GET /projects/:id/deployment-preflight` 暴露同一份合同。该合同必须检查私有试点部署环境的 store/audit sink、scheduler、access-control mode、signed headers、replay protection、audit fail-closed、secret vault、provider policy、managed persistence adapter、worker queue adapter、adapter gateway preflight 和 operations readiness，输出 private-pilot deployment blocker gates、warnings、production controls 和 checksum；本地 shadow adapter 可以通过私有试点 blocker gates，但 productionDeploymentReady 在真实托管数据库、队列、KMS、身份、审计和运维控制补齐前必须保持 false
- **敏感信息持久化边界**：模型/搜索密钥、Bearer token、secret-bearing URL、sourceRefs、Agent 提交正文、评审意见和事件账本 payload 在进入本地存储、工作区文件、群聊 proof 或流程图 proof 前必须经过脱敏；本地 MVP 必须能通过 secret-vault status 证明密钥可被 envelope 加密封装、可完成 `secret-vault-rotation-receipt/v1` 轮换 rehearsal，且 readiness 响应不泄露明文；生产版仍需托管 KMS/Secret Manager、真实密钥轮换、撤销与权限审计
- **安全边界可视化、访问控制与审计**：Manager Ready Package 必须展示当前路由权限清单、角色访问策略、可选签名访问头状态、签名请求重放防护状态、审计写入失败即拒绝状态、项目成员策略状态、敏感字段覆盖、脱敏扫描结果、访问审计摘要、后端审计流状态、审计流 hash-chain 完整性和生产安全 blocker；后端必须能在强制访问模式下拒绝 Agent 越权提交、Reviewer 身份冒用、只读用户导出敏感快照、重复重放的签名请求、审计无法落盘的敏感访问和非项目成员访问项目资源；项目成员策略应能作为项目状态持久化，至少覆盖 Manager / security-admin / observer / runtime / Agent / Reviewer 绑定、撤销列表、修订号和审计记录，并能导出到未来的成员策略/授权表；当部署方配置访问签名密钥时，强制访问请求还必须携带有效的签名身份头，避免直接信任可伪造的角色头；所有允许/拒绝的敏感访问决策都必须写入可回放审计记录和后端审计流，后端审计流必须提供连续 sequence 与 tamper-evident hash-chain proof；本地脱敏、签名头、重放缓存、审计 fail-closed、项目成员策略和原型级访问控制通过只能说明可进入 MVP 内测，不等于已经满足正式上线安全要求
- **本地身份会话与运行凭证合同**：私有 MVP 必须支持项目级 `identity-session/v1` 本地会话合同，用于验证 Manager / security-admin 等项目成员在不重复签名请求头的情况下访问后端 proof route。会话 token 只能在签发响应中返回一次，项目状态、持久化快照、Manager Ready Package 和安全边界只能保存 token hash、checksum、状态、签发/过期/撤销信息和公开摘要。后端必须支持 `GET|POST /projects/:id/identity-sessions`，以及撤销单个 session 的后端路径；会话签发、使用、撤销必须进入 timeline、event ledger、security access audit、backend audit stream、persistence snapshot、migration seed order 和 Manager 安全边界摘要。该能力只证明本地/私有试点的运行凭证边界，不等于正式生产 IdP、浏览器登录态、服务账号签发、密钥轮换或集中审计已经完成。
- **运行健康与恢复可见性**：Manager Ready Package 必须展示本地运行健康、worker 队列、审计流顺序、持久化恢复源、数据库迁移 dry-run、证明链可回放、告警规则草案、恢复 runbook 和 `operations-incident-drill/v1` 演练收据；演练收据至少要证明告警能路由到 proof surface、恢复步骤有 evidence route、队列/持久化/审计链检查通过；该能力只能证明本地/内测可观测性，正式上线仍需要集中日志、指标、告警、备份恢复演练和事故责任机制
- **Managed Persistence Adapter 上线验证**：在替换本地 JSON/file store 前，Manager Ready Package 必须展示 managed persistence adapter plan 与 dry-run 结果；后端必须通过 `GET /projects/:id/persistence-adapter-plan` 和 `GET /projects/:id/persistence-adapter-dry-run` 暴露数据库 cutover 合同，至少覆盖项目、消息、事件账本、任务、Agent 状态、提交、证据搜索、评审、成员策略、签名重放记录、访问审计、安全审计流、provider usage ledger、provider eval runs、worker runs、read-model checkpoints 等关键表，并验证 adapter execution receipt、shadow-read parity、transaction rollback、backup/restore、RLS 草案、audit-stream 连续性和 read-model checkpoint parity；dry-run 通过只能证明可进入内测 cutover 演练，不等于已经完成真实托管数据库部署
- **Worker 恢复状态可见性**：Manager Ready Package 必须展示 worker execution receipt、retry state、dead-letter queue、最大重试次数和恢复 route；本地 MVP 可以用该合同证明队列恢复语义，但正式上线仍需要生产级 queue/cron、durable lease、managed dead-letter storage 和恢复演练
- **Queue Adapter 上线验证**：在替换本地 Node scheduler 前，Manager Ready Package 必须展示 worker-queue adapter plan 与 dry-run 结果，至少覆盖 adapter driver status、adapter execution receipt、enqueue、idempotency、lease acquisition、dispatch route、execution receipt ack、retry policy import、dead-letter recovery、queue inspection、`worker-queue-adapter-snapshot-parity/v1` 快照一致性和 cutover blocker；dry-run 通过只能证明可进入内测，不等于已部署真实生产队列
- **外部 Adapter Gateway 验证**：当部署方选择 `http-json` 私有 adapter gateway 时，必须先通过共享 gateway 合同验证。该验证至少包含 `adapter-gateway-health/v1`、`adapter-gateway-state-summary/v1`、`managed-persistence-adapter-execution-receipt/v1` 和 `worker-queue-adapter-execution-receipt/v1`。后端必须通过 `GET /projects/:id/adapter-gateway-preflight` 暴露 `adapter-gateway-preflight/v1`：本地 shadow 模式要证明当前私有试点 rehearsal 路径明确；`http-json` 模式要读取私有 gateway 的 live health、state summary、能力声明和存储/队列元信息，并把结果纳入 Manager Ready Package 与部署前预检。配置 `MANAGED_PERSISTENCE_ADAPTER_DRIVER=http-json` 或 `WORKER_QUEUE_ADAPTER_DRIVER=http-json` 后，对应项目级 dry-run API 必须能调用私有 gateway 并返回 gateway execution receipt。产品应提供一个本地私有 gateway 参考进程，支持 bearer token、storage adapter status、shadow table record 持久化、queue row / lease / dead-letter 状态持久化、persistence dry-run 和 queue dry-run，以便私有试点先完成部署形态验证；但在真实数据库/队列 cutover 审批前不得返回 `productionCutoverReady: true`
- **Postgres-compatible Gateway Store 验证**：当 `ADAPTER_GATEWAY_STORAGE_DRIVER=postgres` 或 `postgres-compatible` 时，gateway storage adapter 必须暴露 `adapter-gateway-postgres-schema-plan/v1`、脱敏后的数据库连接信息、schema 名称、query-bound 状态、最新写入执行摘要和 `adapter-gateway-postgres-readback/v1` 读回摘要；验证必须覆盖 schema plan、project summary、table record、queue row、queue lease、dry-run receipt、state snapshot 写入操作，以及 snapshot checksum 与 table/queue count readback parity。该验证只证明私有 gateway 已具备托管 Postgres 的 schema/upsert/readback 合同边界，不等于真实数据库备份恢复、RLS、监控和 cutover 审批已经完成。
- **本地数据存储**：所有项目数据、会议记录、AI 交互日志，均存储在用户部署环境，平台不收集任何数据

---

## 五、核心页面模块

| 模块 | 功能要点 |
|------|----------|
| **项目组管理页** | 新建 / 切换项目组、查看项目组列表 |
| **AI 雇员招聘市场** | 分类浏览、雇佣、解聘 AI 雇员 |
| **圆桌会议页** | 可视化圆桌讨论界面、提问交互、会议总结生成 |
| **项目进度页** | 整体进度展示、AI 工作状态、每日工作汇报、项目日志 |
| **项目控制台** | 会议纪要展示、核心结论展示、分工方案展示、项目迭代记录 |

---

*文档版本：最终定稿版*
