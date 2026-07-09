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
- 防回归: 待补 —— 解析函数（`extractBalancedJsonObject` / `parseModelLineTurns` / `topicTermsForMeeting`）是纯函数，最适合做第一批 node:test 特征测试。
- 关联债务: TD-004（多层兜底链复杂度）。

## BUG-003: 设置页"测试模型/搜索连接"行为异常

- 状态: `fix-landed-unverified`
- 现象: 在设置页填入新 API Key / Base URL / 模型名点"测试"时：要么测的是旧配置，要么测试要求返回 JSON 导致部分模型必失败；自定义 Base URL 和模型名无法通过密钥库下发到后端。
- 根因: (a) `testModelProvider` 只会测启动时创建的全局 provider，忽略请求里带的临时凭据；(b) `test()` 强制 JSON 输出 + 512 tokens，对小模型/网关不友好；(c) 密钥库只支持 `model.apikey`，没有 `model.endpoint` / `model.name` 的绑定通道；(d) provider 的 model/baseURL 创建后不可变（无 `setConfig`）。
- 修复: `0fa01378` —— `testModelProvider`/`testSearchProvider` 支持临时凭据建 transient provider（不落盘）；`test()` 改为轻量 "Reply exactly: OK"（64~128 tokens，15s 超时）；密钥库新增 `model.endpoint` / `model.name` 词表与绑定逻辑（server 与 service 两处）；provider 增加 `setConfig({baseURL, model})`，blockedByPolicy 改为动态计算。
- 防回归: 待补 —— providerSecretBinding 词表匹配是纯函数；另见 TD-005（两处复制必须先合并，否则此类 bug 会复发）。
- 关联债务: TD-005。

## BUG-004: 密钥库同名记录重复堆积

- 状态: `fix-landed-unverified`
- 现象: 反复保存同一个密钥（如 `model.apikey`）后，vault 里出现多条同名记录，读取时命中哪条不确定。
- 根因: `secretVault.js` 的 `seal` 无条件 `push`，不检查同 id/同 name 记录。
- 修复: `0fa01378` —— seal 时按 id/name 查重，存在则原位替换（splice），否则追加。
- 防回归: 待补 —— node:test：同名 seal 两次，断言 `exportRecords().length === 1` 且内容为第二次的值。

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
