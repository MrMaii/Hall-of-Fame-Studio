# Local Product Reliability Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Hall of Fame Studio 改造成稳定、流畅、普通用户可长期使用的纯本地开源产品，并用真实本地运行证明 P0、P1、P2 和五类任务要求。

**Architecture:** 先修复文件存储升级和本地启动监督，再建立统一的会议运行状态接口。P1 在现有视觉语言内减少普通模式内容并完善首次使用；P2 按职责拆分界面、统一后台操作规则并补齐本地诊断、启动和适配验证。

**Tech Stack:** Node.js 22/24、React 18、Vite 5、Node test runner、Playwright、本地 JSON/JSONL 文件存储。

## Global Constraints

- 所有项目、用户、权限、文件、记忆、任务、会议、日志、恢复和运行控制必须保存在本地。
- 不增加云数据库、云认证、云队列、云存储、云监控或云部署依赖。
- 修改本地数据格式或升级过程前必须建立备份并验证恢复。
- 只修改与 P0-P2 和五类真实任务验证直接相关的内容。
- 普通用户界面使用中文，不显示内部地址、测试字段或实现代码。
- 每个行为修改都先建立失败验证，再实施最小修复。
- 浏览器验证使用 Codex 应用内浏览器，并保留规定尺寸截图。

---

### Task 1: 修复真实项目数据升级校验失败

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `tests/agentProjectFileStoreMigration.test.mjs`
- Modify: `scripts/validate-local-store-migration-safety.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Consumes: `createAgentProjectFileStore({ filePath, hydrateProject })`
- Produces: 可在项目补充字段后提交的 `agent-project-store-migration-transaction/v1`

- [x] **Step 1: 增加真实项目补充字段的失败测试**

```js
test('commits the exact hydrated snapshot written during a version-one migration', () => {
  const store = createAgentProjectFileStore({
    filePath,
    hydrateProject: (project) => ({ ...project, runtimeState: { status: 'idle' } }),
  });
  assert.equal(store.integrity.migrationTransaction.status, 'committed');
  assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).projects[0].runtimeState.status, 'idle');
});
```

- [x] **Step 2: 运行测试并确认当前代码出现校验失败**

Run: `node --test tests/agentProjectFileStoreMigration.test.mjs`

Expected: 新测试以 `agent-project-store-migration-target-checksum-mismatch` 失败。

- [x] **Step 3: 将迁移目标校验值改为实际持久化快照的校验值**

把迁移事务准备移动到内存存储完成项目补充之后，使用 `memoryStore.snapshot()` 计算将要写入磁盘的目标校验值。已有 `prepared` 事务必须通过原始存档校验和目标版本验证后才能更新目标校验值。

- [x] **Step 4: 运行迁移、损坏、回退和原子替换测试**

Run: `npm run agents:store-migration-safety`

Expected: 全部通过，且原始存档、事务记录和回退能力保留。

- [x] **Step 5: 使用安全备份保护后验证当前 44MB 数据升级**

Run: 设置 `AGENT_PROJECT_STORE` 指向安全副本后启动 `scripts/agent-project-server.mjs`，检查 `/health`、`/local-mvp-startup-readiness` 和项目数量。

Expected: 后端启动、2 个项目存在、事务状态为 `committed`。

### Task 2: 增加启动前备份、失败恢复和损坏项目隔离

**Files:**
- Create: `src/agents/localStartupRecovery.js`
- Create: `tests/localStartupRecovery.test.mjs`
- Modify: `scripts/agent-project-server.mjs`
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: `prepareLocalStartupRecovery({ storePath, backupDirectory, now })`
- Produces: `recoverLocalStartupFailure({ receipt, error })`
- Produces: `local-startup-recovery/v1` 本地记录

- [x] **Step 1: 测试启动前备份包含主数据、备份、迁移记录和原始存档**
- [x] **Step 2: 测试升级失败后恢复原文件且保留失败数据副本**
- [x] **Step 3: 测试单个无法补充字段的项目被移入隔离记录，其他项目继续启动**
- [x] **Step 4: 在文件存储启动阶段完成升级存档、失败目标存档和项目隔离**
- [x] **Step 5: 运行迁移、恢复、隔离和原子写入验证**

Expected: 所有备份、恢复和隔离行为通过公开文件存储接口验证。

### Task 3: 后端失败时保留前端并提供本地恢复状态

**Files:**
- Modify: `scripts/local-dev.mjs`
- Create: `src/localRuntime/localServiceStatus.js`
- Create: `tests/localDevSupervisor.test.mjs`
- Modify: `src/App.jsx`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: `.tmp/local-runtime-status.json`，格式 `local-runtime-status/v1`
- Produces: 前端本地服务状态、失败原因、重新启动和恢复操作

- [x] **Step 1: 测试后端退出后 Vite 继续运行且状态文件记录失败**
- [x] **Step 2: 测试前端退出时后端安全停止**
- [x] **Step 3: 修改监督程序，区分前端退出与后端失败**
- [x] **Step 4: 在首次打开页面显示普通中文状态和恢复操作**
- [x] **Step 5: 运行监督测试并在浏览器中模拟后端失败**

Expected: 后端失败不会关闭前端，用户可看到原因和下一步操作。

### Task 4: 统一会议消息和AI运行状态

**Files:**
- Create: `src/meeting/meetingRunController.js`
- Create: `src/meeting/meetingMessageState.js`
- Create: `src/meeting/MeetingControls.jsx`
- Create: `tests/meetingRunController.test.mjs`
- Modify: `src/App.jsx`
- Modify: `tests/localRuntimeUiLatency.test.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: `createMeetingRunController({ timeoutMs, schedule })`
- Produces: `submitUserMessage({ id, text, submittedAt })`
- Produces: `stop()`, `cancel()`, `retry(messageId)`, `skipCurrentSpeaker()`
- Produces: 消息状态 `submitting|saved|processing|completed|failed`

- [x] **Step 1: 测试用户消息在任何后端等待前进入可见记录**
- [x] **Step 2: 测试连续消息不会被AI运行锁定**
- [x] **Step 3: 测试停止、取消、跳过和重试**
- [x] **Step 4: 测试超时后状态为失败并保留重试内容**
- [x] **Step 5: 实施统一控制器并替换两个会议发送实现**
- [x] **Step 6: 默认只安排负责人回答，明确要求全员时再增加成员**
- [x] **Step 7: 浏览器验证即时显示、连续发送、停止、后端失败退出和重启保存**

Expected: 用户消息立即显示，会议过程可控制，旧页面和新页面行为一致。

### Task 5: 简化普通用户首页和首次使用流程

**Files:**
- Create: `src/onboarding/LocalFirstRunFlow.jsx`
- Create: `src/project/ProjectOverview.jsx`
- Create: `src/project/ProjectAdvancedDetails.jsx`
- Create: `src/ui/LocalDataStatus.jsx`
- Modify: `src/App.jsx`
- Modify: `scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: 自动本地服务检测、本地用户、模型、项目、团队和首次工作步骤
- Produces: 只显示目标、进度、当前工作、用户决定、最近成果、团队状态和继续工作的项目首页

- [ ] **Step 1: 建立普通模式按钮和内部字段失败检查**
- [ ] **Step 2: 实施首次使用流程并自动使用本地默认地址**
- [ ] **Step 3: 将演示数据降为次要操作并持续标明“演示项目”**
- [ ] **Step 4: 将证明、日志和高级控制移动到按需展开区域**
- [ ] **Step 5: 验证普通模式无空名称按钮、内部地址、测试字段和不明状态代码**

Expected: 新用户不需要理解后端、地址或测试字段即可开始第一个本地项目。

### Task 6: 拆分界面并统一后台操作规则

**Files:**
- Create: `src/settings/SettingsDialog.jsx`
- Create: `src/users/LocalUserPanel.jsx`
- Create: `src/tasks/TaskWorkspace.jsx`
- Create: `src/runtime/localCommandPolicy.js`
- Create: `src/runtime/localOperationRegistry.js`
- Modify: `src/App.jsx`
- Modify: `vite.config.js`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: 统一超时、重试、错误记录和唯一操作标识
- Produces: 按页面加载的设置、用户、任务和高级详情模块

- [ ] **Step 1: 为统一操作状态和重复点击建立测试**
- [ ] **Step 2: 提取公共操作规则并替换分散的等待值**
- [ ] **Step 3: 按职责移动现有组件，不改变已验证行为**
- [ ] **Step 4: 为高级区域增加按需加载**
- [ ] **Step 5: 运行构建、单元测试和前端包体检查**

Expected: `App.jsx` 不再承担全部职责，后台操作状态一致且不会重复提交。

### Task 7: 本地启动、诊断、性能和系统适配

**Files:**
- Create: `scripts/hofs-local-launcher.mjs`
- Create: `scripts/start-hall-of-fame-studio.cmd`
- Create: `src/agents/localDiagnosticExport.js`
- Create: `tests/localDiagnosticExport.test.mjs`
- Create: `scripts/validate-local-platform-compatibility.mjs`
- Modify: `package.json`
- Modify: `scripts/local-dev.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: Node.js 版本检查、端口检测、Windows 双击启动、本地诊断导出
- Produces: 默认移除密钥、令牌、消息正文和用户隐私的诊断包

- [ ] **Step 1: 测试 Node.js 版本和端口冲突提示**
- [ ] **Step 2: 实施启动器和 Windows 双击入口**
- [ ] **Step 3: 测试诊断导出敏感内容扫描**
- [ ] **Step 4: 实施诊断导出和本地运行记录**
- [ ] **Step 5: 验证中文路径、空格路径、离线环境和首次安装**
- [ ] **Step 6: 记录 Windows 实机以及 macOS/Linux 自动验证状态**

Expected: 普通 Windows 用户可启动，常见环境错误有明确中文说明，诊断包不包含敏感内容。

### Task 8: 多尺寸、缩放和可访问性验证

**Files:**
- Create: `scripts/validate-local-responsive-ui.mjs`
- Create: `docs/LOCAL_PRODUCT_UI_VERIFICATION.md`
- Modify: `src/App.jsx`
- Modify: extracted UI component files from Tasks 4-6
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: 七种屏幕尺寸和四种缩放比例的截图与主要流程结果

- [ ] **Step 1: 自动检查可访问名称、输入标签、焦点和正文最小字号**
- [ ] **Step 2: 在 1920×1080、1600×900、1440×900、1366×768、1280×720、1024×768、390×844 验证**
- [ ] **Step 3: 在 100%、125%、150%、200% 缩放验证**
- [ ] **Step 4: 修复无法访问、被截断和无法关闭的内容**
- [ ] **Step 5: 保存截图和最终验证结果**

Expected: 所有规定尺寸和缩放比例均可完成首次使用、项目和会议主要操作。

### Task 9: 五类真实任务和最终回归

**Files:**
- Create: `scripts/validate-five-local-work-modes.mjs`
- Create: `docs/LOCAL_PRODUCT_FINAL_REPORT.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`

**Interfaces:**
- Produces: 学习、论文、调查、技术、创作五类从创建到成果导出的本地验证记录

- [ ] **Step 1: 运行五类任务并验证重启后数据存在**
- [ ] **Step 2: 正常启动连续运行10次**
- [ ] **Step 3: 运行全量自动测试、构建和真实浏览器操作**
- [ ] **Step 4: 检查没有新增云端依赖或原始敏感内容**
- [ ] **Step 5: 逐项更新 P0、P1、P2 状态并生成主管报告**

Expected: 只有清单全部有直接证据且没有剩余必需工作时，目标才可标记完成。
