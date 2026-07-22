# Human-readable Collaboration Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让会议/群聊只显示真实成员的自然交流，让节点流像 Git commit 一样直接说明“谁做了什么”，不再用“管理员、项目修订、脉冲、智能体运行记录”等内部术语代替正文。

**Architecture:** 保留现有事件类型、来源、审计 ID、证据关系和 cadence 等内部字段，但把“会出现在什么界面”和“用户看到什么句子”明确分开。聊天读取模型只返回真实对话；节点流使用结构化事件生成自然语言标题；旧数据在读取时投影为新文案，不重写原始审计记录。

**Tech Stack:** React 18、Node.js ESM、内置 `node:test`、Vite。

## Global Constraints

- 不删除 `eventType`、`source`、`cadence`、proof IDs、timeline IDs 或 event IDs。
- 不改写已有持久化审计记录；旧记录只在读取和展示时转换。
- 群聊/会议中只出现真实用户或项目成员说过的话，后台日志不能伪装成聊天消息。
- 节点主标题必须能回答“谁做了什么”；内部分类只能用于筛选、图形样式和详情。
- 中文正文不得出现“Agent 脉冲、管理信号、管理检查、项目设置修订、智能体运行记录、管理记录”等兜底术语。
- 无法从旧记录生成有意义标题时，该记录留在审计账本，不进入主节点流。

---

### Task 1: 固化用户可见语言契约

**Files:**
- Create: `src/project/humanReadableRecords.js`
- Create: `tests/humanReadableRecords.test.mjs`

**Interfaces:**
- Produces: `isConversationMessage(record)`、`activitySentence(record, context)`、`isMeaningfulActivitySentence(text)`。

- [ ] **Step 1: 写失败测试，覆盖用户给出的反例和期望句式**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activitySentence,
  isConversationMessage,
  isMeaningfulActivitySentence,
} from '../src/project/humanReadableRecords.js';

test('operational logs are not conversation messages', () => {
  assert.equal(isConversationMessage({ source: 'timeline-log', eventType: 'project-settings-updated' }), false);
  assert.equal(isConversationMessage({ source: 'agent-work-cycle', eventType: 'agent-work-pulse' }), false);
  assert.equal(isConversationMessage({ source: 'war-room-meeting-message', speaker: '孔子', text: '我建议先做小样本验证。' }), true);
});

test('workflow activity reads like a commit', () => {
  assert.equal(activitySentence({ eventType: 'task-completed', actor: '林肯', taskTitle: '登录页接口' }), '林肯完成了登录页接口');
  assert.equal(activitySentence({ eventType: 'approval', actor: '总监', targetName: '马斯克', object: '负责数据清理' }), '总监批准马斯克负责数据清理');
  assert.equal(activitySentence({ eventType: 'message-read', actor: '达·芬奇', object: '新的问卷分组要求' }), '达·芬奇读到了新的问卷分组要求');
});

test('generic internal labels are never meaningful activity titles', () => {
  for (const text of ['智能体运行记录', '管理记录', '项目设置修订 7 已更新。', 'Agent 脉冲']) {
    assert.equal(isMeaningfulActivitySentence(text), false);
  }
});
```

- [ ] **Step 2: 运行测试，确认因模块不存在而失败**

Run: `node --test tests/humanReadableRecords.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现最小的纯函数语言边界**

`isConversationMessage` 只认可真实发言来源或显式 `recordKind: 'conversation'`；`activitySentence` 先使用合格的 `commitMessage/displayText`，否则按 `actor + verb + object + outcome` 组句；`isMeaningfulActivitySentence` 拒绝内部术语和空泛标题。函数不得依赖 React 或后端存储。

- [ ] **Step 4: 运行测试并提交**

Run: `node --test tests/humanReadableRecords.test.mjs`

Expected: PASS。

Commit: `git commit -m "test: define human readable record contract"`

---

### Task 2: 把后台日志从会议和群聊中分离

**Files:**
- Modify: `src/agents/agentProjectService.js:8514-8720`
- Modify: `src/App.jsx:547-565`
- Modify: `src/App.jsx:21919-22073`
- Modify: `src/project/AdvancedProjectChat.jsx:101-120`
- Modify: `src/meeting/MeetingTranscriptPanel.jsx`
- Modify: `src/meeting/AdvancedMeetingRoom.jsx:265-305`
- Create: `tests/conversationTranscriptBoundary.test.mjs`
- Modify: `scripts/validate-agent-manager-scenario.mjs:647-648,1406-1410,3207-3213`

**Interfaces:**
- Consumes: `isConversationMessage(record)` from Task 1。
- Produces: transcript read models whose `messages` and `archivedProofMessages` contain conversation only; audit proof counts remain separately available.

- [ ] **Step 1: 写失败测试证明时间线日志不会再变成聊天消息**

建立一个同时含有真实会议发言、成员聊天、`project-settings-updated`、`agent-work-pulse` 和 `management-check-in` 的项目。断言 `/transcripts/main` 只包含真实发言，且 `/timeline`、`/events` 仍保留全部审计记录。

- [ ] **Step 2: 拆分 `transcriptRecoveredMessages` 的职责**

将其改为只恢复立项会议发言、负责人竞选发言、用户澄清和有明确原始消息 ID 的真实成员消息。`project.logs` 不再无条件映射为 `author/role/text` 聊天消息；纯运行日志只参与 timeline/event/proof read models。

- [ ] **Step 3: 在完整群聊中使用同一条语义过滤规则**

删除 `App.jsx` 中依赖固定作者名单的 `hiddenSystemAuthors` 方案，把 Task 1 的 `isConversationMessage` 用在完整群聊和离线恢复路径。`AdvancedProjectChat` 继续展示回复、@提及、附件和已读信息，但不再渲染运行日志卡片。

- [ ] **Step 4: 固化会议记录边界**

`MeetingTranscriptPanel` 和 `AdvancedMeetingRoom` 只接收 `meeting-turn/director-input` 类型；成员姓名和实际发言保持原文，不对姓名或发言正文套用“系统文本兜底翻译”。

- [ ] **Step 5: 更新验证并提交**

Run: `node --test tests/conversationTranscriptBoundary.test.mjs tests/projectTranscriptRecovery.test.mjs`

Run: `npm.cmd run agents:transcript-contracts`

Expected: 全部 PASS；脚本仍能验证历史证明覆盖，但不再要求 `archivedProofMessages` 含纯日志。

Commit: `git commit -m "fix: keep operational logs out of conversations"`

---

### Task 3: 让新生成的对话使用正常人语言

**Files:**
- Modify: `src/i18n/locales/zh.js:55-100`
- Modify: `src/i18n/locales/en.js:55-100`
- Modify: `src/agents/agentRuntime.js:1460-1535`
- Modify: `src/agents/agentProjectService.js:4487-4649`
- Modify: `tests/chineseLanguageMode.test.mjs`

**Interfaces:**
- Produces: natural chat templates that name the person, task, decision or idea without runtime terminology.

- [ ] **Step 1: 把当前怪词写成负向断言**

断言所有用户可见模板都不包含 `脉冲|管理信号|管理检查|证据标记|智能体运行记录|管理记录`，同时必须包含实际人名和工作对象。

- [ ] **Step 2: 将模板改成自然沟通**

采用以下语气标准：

```text
旧：孔子：@达·芬奇 这是来自我的 Agent 脉冲的同级管理检查。
新：孔子：@达·芬奇，请继续完成问卷原型；完成后把结果发到这里。

旧：马斯克已回应管理信号，并将其纳入当前工作脉冲。
新：马斯克：收到，我会按林肯的建议修改数据清理方案，完成后发出结果。

旧：“登录页”已有进展：我执行了实现例行程序，并发布了证据。
新：图灵：登录页接口已经可以登录和退出；我接下来补错误提示。
```

模板只能描述当前确实存在的 `workText`、`artifact`、`target`、`nextStep`；没有这些数据时用简短的“收到，我先检查并回复”，不能编造结果。

- [ ] **Step 3: 保留内部协议值但禁止它们进入正文**

`eventType: 'agent-work-pulse'`、`cadence`、`management-*` 可继续用于调度和审计；`time` 改为真实时间或普通状态，不再显示 `Agent Pulse`。

- [ ] **Step 4: 运行语言与运行时测试并提交**

Run: `node --test tests/chineseLanguageMode.test.mjs tests/humanReadableRecords.test.mjs`

Run: `npm.cmd run agents:smart-meeting-runtime`

Expected: PASS，且负向术语扫描为零。

Commit: `git commit -m "fix: make agent conversation language natural"`

---

### Task 4: 让节点流主标题采用 commit 语义

**Files:**
- Modify: `src/agents/agentProjectService.js:1260-1355`
- Modify: `src/agents/agentProjectService.js:42973-43060`
- Modify: `src/i18n/managerFlowChinese.js`
- Modify: `src/project/AdvancedProjectTimeline.jsx:413-505`
- Modify: `src/project/ProjectTimelineRouteView.jsx:210-270`
- Create: `tests/humanReadableWorkflowNodes.test.mjs`

**Interfaces:**
- Consumes: `activitySentence(record, context)` and `isMeaningfulActivitySentence(text)` from Task 1。
- Produces: every public node has `displayTitle`; internal `category/subtype/status/source` remain metadata.

- [ ] **Step 1: 写代表性节点测试**

覆盖完成任务、提交代码/文档、提出想法、批准工作、读到需求、确认分配、要求修改和设置变化。每个节点断言 `displayTitle` 包含真实 actor 和 object，并拒绝通用标题。

- [ ] **Step 2: 在后端节点读取模型中生成 `displayTitle`**

优先级固定为：有效的 agent-authored `commitMessage` → 结构化 `actor + action + object + outcome` → 从旧日志事件类型投影。无法生成合格标题的节点标记 `publiclyVisible: false`，只留在 Event Ledger。

- [ ] **Step 3: 修正旧数据的显示投影**

示例：

```text
Project settings revision 7 updated ...
→ 总监把项目语言改为中文，并更新了隐私设置

Agent work pulse
→ 林肯完成了问卷 API 的第一版，并提交代码供复核

management-check-in
→ 孔子请达·芬奇继续完成问卷原型
```

投影只改变读取结果，不修改原始 `log`、event ledger 或 checksum。

- [ ] **Step 4: 调整节点视觉层级**

`AdvancedProjectTimeline` 卡片第一行只显示 `displayTitle`。分类、状态和来源移入次要详情或筛选器，不再与标题争夺视觉优先级；现有 proof、附件、关系边和时间坐标保持不变。

- [ ] **Step 5: 移除误导性中文兜底**

`managerFlowChinese.js` 不再把未知英文统一降级成“智能体运行记录/管理记录/流程记录”。姓名绝不翻译；用户正文保持原文；系统活动必须经过 Task 1 的句子生成器。

- [ ] **Step 6: 运行节点契约并提交**

Run: `node --test tests/humanReadableWorkflowNodes.test.mjs tests/chineseLanguageMode.test.mjs`

Run: `npm.cmd run agents:workflow-nodes`

Run: `npm.cmd run agents:timeline-action`

Expected: PASS；节点主标题负向术语扫描为零。

Commit: `git commit -m "fix: render workflow nodes as meaningful commits"`

---

### Task 5: 真实用户验收与回归

**Files:**
- Modify: `scripts/validate-manager-backend-ui.mjs`
- Modify: `scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs`
- Modify: `scripts/validate-language-system.mjs`

**Interfaces:**
- Consumes: Tasks 2-4 的 transcript 和 workflow read models。
- Produces: 浏览器级验收，覆盖刷新和旧项目恢复。

- [ ] **Step 1: 增加浏览器验收场景**

创建项目并让成员完成一次讨论、提出一个想法、确认一项工作、提交一次结果。刷新页面后断言：群聊仍是普通成员对话；节点流标题分别说明讨论、想法、确认和提交；页面上不存在禁止词。

- [ ] **Step 2: 验证旧项目兼容性**

加载含旧 `project-settings-updated`、`management-check-in` 和 `agent-work-pulse` 的项目。断言聊天中不出现这些日志；节点流显示自然语言投影；Event Ledger 仍能找到原始类型和 proof IDs。

- [ ] **Step 3: 运行完整回归**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Run: `npm.cmd run agents:scenario`

Run: `npm.cmd run ui:manager-backend:real-user-chain`

Expected: 全部 PASS；真实用户链路截图中只有自然对话和明确的工作节点标题。

- [ ] **Step 4: 提交最终验收变更**

Commit: `git commit -m "test: verify human readable collaboration records"`

---

## Self-review Result

- Spec coverage: 普通群聊、会议发言、commit 风格节点、批准/阅读/想法等沟通节点、旧数据兼容均有对应任务。
- Scope boundary: 不删除审计和证明数据，不重做节点图布局，不扩展新的协作功能。
- Type consistency: Task 1 的三个纯函数由 Tasks 2-4 共同消费；`displayTitle` 只用于用户可见节点投影。
- Main product decision: 群聊是“人说的话”，节点流是“人做的事”，Event Ledger 才是“系统如何记录”。
