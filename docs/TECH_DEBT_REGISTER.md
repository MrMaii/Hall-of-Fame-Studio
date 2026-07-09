# 技术债登记册（Tech Debt Register）

> 更新规则：每发现一条债务就登记；状态只允许 `open` / `in-progress` / `resolved` / `accepted`（accepted = 明确决定不修）。
> 铁律：**任何清理动作不得改变现有功能与界面效果**，行为变化只能来自明确的 bug 修复，且需在 `BUG_LOG.md` 留档。
> 基线提交：`0fa01378`（2026-07-08）。

## 登记表

| ID | 位置 | 描述 | 影响 | 严重度 | 状态 | 处理计划 |
|----|------|------|------|--------|------|----------|
| TD-001 | `src/agents/agentProjectService.js` | 约 62,000 行巨石文件：项目/会议/聊天/自治周期/证据/设置全部业务逻辑 + schema/receipt 构建混在一个文件 | 无法单元测试；改一处易牵连他处；多人/多 agent 协作必冲突 | P0 | open | 按领域拆分（projects / meetings / chat / autonomy / evidence / settings），拆前先写特征测试，逐字搬运不改逻辑 |
| TD-002 | `src/App.jsx` | 约 38,000 行巨石组件 `EngineWorkspace`：全部 UI + 状态 + fetch 逻辑在单文件；Babel/Vite 已警告超 500KB，产物 2.1MB 单 chunk | HMR 慢、构建警告、无法局部测试、UI bug 定位困难 | P0 | open | 按页面/面板拆组件与 hooks；配合 manualChunks 分包；拆前用 Playwright validate 脚本做回归锚点 |
| TD-003 | 整个仓库 | 无单元测试：质量保障全靠 85+ 个 `scripts/validate-*.mjs`（静态源码断言 + Playwright 端到端） | 反馈慢（分钟级）、静态断言与实现强耦合（重构即碎）、无法隔离验证纯函数 | P0 | in-progress | 已引入 `npm test`（node --test，零新依赖），首批 22 个特征测试覆盖 secretVault / modelProvider / providerSecretBinding；后续随拆分逐模块补 |
| TD-004 | `src/agents/agentProjectService.js` 内 kickoff 相关函数 | 模型输出解析链路复杂：行格式 → JSON → normalizeJsonLikeText → repairModelCompletionJson（再调一次 LLM）→ 主题匹配重试，多层兜底叠加 | 失败模式难预测；每层兜底都可能掩盖上游真实问题；调试成本高 | P1 | open | 先补特征测试锁定当前行为；把解析链抽成独立模块并记录每层触发率，再决定是否精简 |
| TD-005 | `scripts/agent-project-server.mjs` 与 `agentProjectService.js` | `providerApiKeyNames` / `providerEndpointNames` / `providerModelNames` / `normalizeProviderSecretTarget` / `providerSecretBindingForRecord` 两处完整复制 | 改一处忘另一处 → 密钥绑定行为不一致（已在本轮 diff 中出现两处同步修改） | P1 | resolved | 已提取到 `src/agents/providerSecretBinding.js` 单一来源（逐字搬运），两侧引用，`tests/providerSecretBinding.test.mjs` 锁定行为；`agents:server:validate` + 服务器冒烟通过 |
| TD-006 | 多文件 | `parseBoolean` 等基础工具函数在多个文件重复实现 | 语义漂移风险 | P2 | open | 汇总到 `src/agents/utils.js`；逐个替换并跑 validate |
| TD-007 | `src/agents/agentProjectApi.js` | 同一路由存在同步/异步双通道（如 `/workspace/pick-folder` 在异步分支处理、同步分支返回 `local-workspace-folder-picker-requires-async-handler`），路由分发逻辑隐式依赖调用方走哪条通道 | 新增路由容易挂错通道，产生"接口存在但永远 400"类 bug（BUG-001 的温床） | P1 | open | 在 ARCHITECTURE.md 里明确两通道规则；长期统一为单一 async 分发 |
| TD-008 | `vite.config` / 构建 | 产物单 chunk 2.16MB（gzip 508KB），超过 Vite 500KB 警告线 | 首屏加载慢；与 TD-002 同源 | P2 | open | 随 TD-002 拆分后配置 manualChunks；纯构建配置，不改行为 |
| TD-009 | 测试脚本 | `validate-local-mvp-release-checklist.mjs`（~4.1k 行）、`validate-frontend-mock-boundaries.mjs`（~3.1k 行）以字符串断言源码内容 | 与实现细节强耦合，源码合法重构也会打破校验；维护成本高 | P1 | in-progress | 已兑现一次代价：`5818eb80` 重构 UI 后约 20 处锚点失配（见 BUG-007），本轮已同步修复；规则：改 App.jsx 标识前先 `rg` scripts/；新增测试一律走 node:test |
| TD-010 | `docs/` | 缺 API 参考、架构图、开发者 onboarding；`agentProjectService.js` 无任何拆分说明 | 新会话/新人无法建立认知，只能靠读 62k 行源码 | P0 | in-progress | 本轮产出 `docs/ARCHITECTURE.md`（模块图 + 端点清单 + 存储格式） |
| TD-011 | git 工作流 | 大量工作长期堆在工作区不提交（本次基线前有 1181 行未提交改动），提交信息全是泛化措辞（"Refine studio flows"） | 无法定位回归引入点；bisect 不可用 | P1 | open | 约定：每个 bug 修复/每个领域改动独立提交，信息写明动机 |
| TD-012 | 行尾符 | 仓库内文件为 LF，Windows 工作区无 `.gitattributes`，git 每次操作都刷 CRLF 警告 | 噪音大；跨平台 diff 可能被行尾污染 | P2 | resolved | 已添加 `.gitattributes`（`* text=auto eol=lf` + 二进制标记），CRLF 警告消除 |

## 已知风险边界（不是债务，但清理时必须绕开）

- **Mock/真实边界**：前端在无后端时回退 mock 的行为是有意设计，登记册在 `docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md`，由 `validate-frontend-mock-boundaries.mjs` 强制。清理时不得移动该边界。
- **发布门禁**：`npm run launch:gates` 是 MVP 发布口径，见 `docs/LAUNCH_READINESS_GATES.md`。
- **确定性引擎**：`agentRuntime.js` 的会议协议是确定性的（LLM 不可用时的回退路径），行为不能变。
