# Bug 日志（BUG_LOG）

> 规则：每个 bug 一条，必填四项：现象 / 根因 / 修复 / 防回归。没有防回归手段的 bug 视为未关闭。
> 下面 BUG-001 ~ BUG-004 是从基线提交 `0fa01378` 的 diff 反推出的修复（Codex 修到一半留在工作区的内容），**均未经用户验证**，验证通过后才可置为 `closed`。

## BUG-001: 工作区文件夹选择器打不开 / 请求报错

- 状态: `fix-landed-unverified`
- 现象: 前端点击"选择本地文件夹"后，`POST /workspace/pick-folder` 报错或整个后端卡死。
- 根因: `localProjectRuntime.js` 用 `spawnSync` 同步启动 PowerShell 文件夹选择对话框，阻塞整个 Node 事件循环（对话框不关，所有 API 都无响应）；且路由挂在同步 `handle()` 通道里，无法等待异步结果。
- 修复: `0fa01378` —— `spawnSync` 改为异步 `spawn` + Promise（含 120s 超时与 kill）；路由迁移到异步通道，同步通道显式返回 `local-workspace-folder-picker-requires-async-handler`。
- 防回归: 待补 —— 需要一个 node:test 用例 mock spawn 验证超时/取消/成功三条路径。
- 关联债务: TD-007（同步/异步双通道路由）。

## BUG-002: 开会（kickoff meeting）失败，报 `model-kickoff-meeting-invalid-json`

- 状态: `fix-landed-unverified`
- 现象: 创建 kickoff 会议时后端抛 `model-kickoff-meeting-invalid-json` 或会议内容跑题（生成通用 AI 研究话题而非项目主题）。
- 根因: 多重叠加——(a) 提示词要求一次性生成完整会议 JSON，输出太长被 `finish_reason: length` 截断；(b) 某些模型返回 markdown 包裹/单引号/带推理前缀的非严格 JSON，原解析只认 `completion.json`；(c) 小模型忽略项目主题。
- 修复: `0fa01378` —— 改为先请求轻量"行格式"开场（agentId | type | text，320 tokens）；失败再回退完整 JSON（maxTokens 提到 8192）；解析链增加容错 JSON 提取（去围栏/中文引号/尾逗号/括号配对）与 LLM 修复重试；新增主题词匹配校验 + strictTopic 重试；空内容且 finish_reason=length 时自动降级重试。
- 防回归: 部分已补 —— `tests/modelProvider.test.mjs` 覆盖空内容/finish_reason=length 与多 provider 内容提取；service 内解析链（`extractBalancedJsonObject` 等）待拆出后补测（TD-004）。
- 关联债务: TD-004（多层兜底链复杂度）。

## BUG-003: 设置页"测试模型/搜索连接"行为异常

- 状态: `fix-landed-unverified`
- 现象: 在设置页填入新 API Key / Base URL / 模型名点"测试"时：要么测的是旧配置，要么测试要求返回 JSON 导致部分模型必失败；自定义 Base URL 和模型名无法通过密钥库下发到后端。
- 根因: (a) `testModelProvider` 只会测启动时创建的全局 provider，忽略请求里带的临时凭据；(b) `test()` 强制 JSON 输出 + 512 tokens，对小模型/网关不友好；(c) 密钥库只支持 `model.apikey`，没有 `model.endpoint` / `model.name` 的绑定通道；(d) provider 的 model/baseURL 创建后不可变（无 `setConfig`）。
- 修复: `0fa01378` —— `testModelProvider`/`testSearchProvider` 支持临时凭据建 transient provider（不落盘）；`test()` 改为轻量 "Reply exactly: OK"（64~128 tokens，15s 超时）；密钥库新增 `model.endpoint` / `model.name` 词表与绑定逻辑（server 与 service 两处）；provider 增加 `setConfig({baseURL, model})`，blockedByPolicy 改为动态计算。
- 防回归: 已补 —— TD-005 已完成合并（`src/agents/providerSecretBinding.js` 单一来源），`tests/providerSecretBinding.test.mjs` + `tests/modelProvider.test.mjs`（setConfig/test() 行为）覆盖。
- 关联债务: TD-005。

## BUG-004: 密钥库同名记录重复堆积

- 状态: `fix-landed-unverified`
- 现象: 反复保存同一个密钥（如 `model.apikey`）后，vault 里出现多条同名记录，读取时命中哪条不确定。
- 根因: `secretVault.js` 的 `seal` 无条件 `push`，不检查同 id/同 name 记录。
- 修复: `0fa01378` —— seal 时按 id/name 查重，存在则原位替换（splice），否则追加。
- 防回归: 已补 —— `tests/secretVault.test.mjs`（同名 seal 两次断言只剩一条且值为第二次），`npm test` 通过。

## BUG-005: `workspace/exec` 全线崩溃 —— `spawnSync` 被删除后未删调用

- 状态: `fixed`
- 现象: 任何走 `POST /projects/:id/workspace/exec` 的命令执行都会抛 `spawnSync is not defined`（ReferenceError），项目自带验证 `validate-agent-manager-scenario.mjs` 在 exec 断言处失败。
- 根因: 基线提交 `0fa01378` 修 BUG-001 时把 `localProjectRuntime.js` 的导入从 `spawnSync` 改成 `spawn`，但 `executeWorkspaceCommand()` 内部仍在调用 `spawnSync`——改导入时没有全文件检查引用。
- 修复: 恢复 `import { spawn, spawnSync }`（本轮提交）。
- 防回归: 项目自带 `validate-agent-manager-scenario.mjs` 的 exec 断言覆盖此路径；该 bug 也是"62k 行文件无单测"的直接受害案例。

## BUG-006: HEAD 提交不自洽 —— 被引用的模块未纳入版本控制

- 状态: `fixed`
- 现象: 干净检出（clone/worktree）后所有加载 `agentProjectService.js` 的脚本直接 `ERR_MODULE_NOT_FOUND: src/agents/meetingQueueProtocol.js`。
- 根因: 已提交的 `agentProjectService.js` 和 `package.json` 引用了 `src/agents/meetingQueueProtocol.js` 与 `scripts/validate-smart-meeting-runtime-contract.mjs`，但这两个文件一直是 untracked 状态，只在本机工作区存在。
- 修复: 提交 `39677b9e` 纳入版本控制。
- 防回归: 建议提交前跑 `git status --short` 检查 untracked 引用；后续可加 CI 干净检出冒烟。

## BUG-007: 契约验证脚本与重构后的 UI 脱节（约 20 处过期锚点）

- 状态: `fixed`
- 现象: `validate-agent-manager-scenario.mjs`、`validate-product-team-acceptance-scenario.mjs`、`validate-frontend-mock-boundaries.mjs` 在干净基线上就失败——不是回归，而是 Codex 最后一次提交 `5818eb80` 重构了发起会议 UI（改为圆桌 roundtable）与浏览器缓存策略，但没同步更新契约脚本里的源码锚点（`meetingTranscript.map`、`initiation-meeting-leader-slate` 等旧标识）。
- 根因: TD-009 —— 验证脚本用「源码必须包含字符串 X」断言实现细节，重命名即碎。
- 修复: 本轮将过期锚点替换为当前等价实现的锚点（leader 经 `/leader` 路由、澄清经 `/clarify`、缓存策略经 `canPersistProjectToBrowserCache` 等），并补回被误删的两个证据 UI 元素（`initiation-meeting-session-proof`、`initiation-meeting-generation-source`——三个 Playwright UI 验证脚本仍在等待这两个 testid）。
- 防回归: TD-009 长期需把字符串断言迁到行为断言；短期规则：改 App.jsx 标识时先 `rg` 一遍 scripts/。

## BUG-008: 后端读模型本地化触发近似二次方级性能塌陷，验证脚本挂起数小时

- 状态: `fixed`
- 现象: `validate-product-team-acceptance-scenario.mjs` 单核 CPU 拉满、运行 2.5 小时以上不结束；后端所有返回读模型的接口在中文语言下响应缓慢。
- 根因: `src/i18n/runtime.js` 的 `localizeText` 每次调用都重建并按长度排序约 1600 条短语的 Map，并对每个词组重新编译正则；而 `localizeReadModel` 递归遍历整个读模型、对每个字符串字段都调用 `localizeText`，两者叠加造成组合爆炸（用 inspector 采样确认热点全部落在 `phraseMapFor` 与正则编译）。
- 修复: 本轮 —— `phraseMapFor` 按语言做模块级缓存（字典是静态的），词边界正则按短语缓存并复位 `lastIndex`；行为对照验证输出不变，2000 次调用约 54ms，验收脚本从 >2.5h 降到约 10 分钟跑完。
- 防回归: 验收脚本本身即为回归门（超时即失败）；后续 TD-004 拆解析链时给 `localizeText`/`localizeReadModel` 补基准断言。
- 关联债务: TD-004（解析/本地化链路复杂度）、TD-001（62k 行 service 使热点难定位）。

---

## 用户报告的 bug（待录入）

> 你在测试中遇到的三个 bug 请按下面模板补录（若与 BUG-001~004 重合则直接在对应条目标注"用户已复现/已验证"）。

## BUG-XXX: <一句话现象>

- 状态: `open`
- 复现步骤:
- 现象:
- 根因:
- 修复:
- 防回归:
