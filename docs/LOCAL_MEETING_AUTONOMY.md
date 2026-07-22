# 本地会议与自治工作链路

这个文档描述本地 MVP 的完整可验收路径：从项目配置、workspace 绑定与 Agent 邀请，到会议、会后纪要、Flow Graph 附件和后续自治工作审计。

## 一条命令启动

在仓库根目录运行：

```powershell
npm run dev
```

该命令同时启动 UI（默认 `http://127.0.0.1:5173`）和本地 Agent backend（默认 `http://127.0.0.1:8787`），并默认启用本地自治调度、Agent 策略、成果提交与评审响应。浏览器所有项目、workspace、会议和成果请求都指向后端；因此不再需要单独启动 backend，也不会因只有 Vite 在运行而出现 `Failed to fetch`。如需暂停本地自治，可在运行前将对应的 `AGENT_AUTONOMOUS_*` 环境变量设置为 `false`。

如果需要本地模型或搜索 Provider，请在运行前设置相应环境变量或本地 Secret Vault 配置；这不会改变 UI/backend 双进程的启动方式。

## 第一次项目运行

1. 在 **Start Initiation** 填写项目名称、目标和产出，邀请所需 Agent，并确认 Leader 与 Reviewer。
2. 选择或创建本地 workspace。确认项目后，浏览器通过后端依次执行 workspace bind、写入/读回标记文件、列目录验证；浏览器不直接写入文件系统。
3. 确认会议后，Leader 自动通过 `POST /projects/:id/meeting-report` 生成第一场会议报告。报告在本地 workspace 的 `meeting-notes/kickoff-summary.md`，并作为一条 Leader 提交同步进入 Manager Flow Graph。
4. 从 Manager Dashboard、Flow Graph、Proof Map、群聊、Timeline 或 Event Ledger 验收结果；每个报告节点都保留 transcript、timeline 和 event 的可追溯链接。

## 会议协议

每条 Director 发言先写入后端 transcript，再为每个 Agent 计算一个说话意图并显示在右上角 Intent Queue。

- 排队顺序来自后端会议结果；第一个 Agent 至少等待 **800 ms**，其余位置根据 `meetingTurnDelayMs` 依次错开。
- Director 说话、输入、中文输入法组合输入或语音识别期间，**Director precedence** 生效：未发言的 Agent 保持 queued，已显示为 speaking 的 Agent 立即标记为 paused，且不再继续显示为当前发言人。
- Director 提交完新的发言后，系统重新生成后端会议轮次和意图队列；旧队列不会抢占最新 Director 输入。
- Director 的每一句发言、Agent 的每一个会议轮次均进入 transcript，并带有 timeline/event 证明，便于低延迟显示与会后审计。

## Agent peer 讨论协议

会议后台现在把 Agent 发言保存为因果讨论链，而不是一组互不相关的 Director 回复。每条 peer 发言都带有 `replyToTurnId`、`targetSpeakerId`、`interactionIntent`、`topicId` 和 `exchangeIndex`；界面会显示它正在回应谁，以及意图是支持、质疑、澄清、竞选、综合或上报。

- 每个 Agent 仍会形成自己的发言意图，但只有与当前议题相关且能增加信息的 Agent 进入发言链。
- 同一议题最多允许 3 条 peer response edge。达到上限后，后端强制由已确认 Leader；若尚未确认，则由推荐 Leader/synthesizer 生成综合或上报发言，不允许 A/B 无限往返。
- Leader 的综合只能形成建议、分歧和待决问题；Leader 不能自行确认选举，也不能替 Director 结束会议。
- Provider 输出在写入 transcript 前会校验 Agent 身份、父发言、目标 Agent、self-reply 和讨论轮数。未知 Agent、悬空回复和越界争论不会进入会议证据。
- 模型上下文使用有预算的结构化 context packet：保留项目简报、团队、Leader/Reviewer、已有决策、风险、未答问题和最多 6 条近期发言；旧 transcript 不再逐条重放。
- 审计证据包含 `peerInteractionEdgeCount`、`convergedTopicIds` 与 `droppedMeetingTurnCount`，可区分真实收敛和被协议拒绝的模型输出。

该协议仍属于本地/私有 Harness。Agent 是由同一后端协调的独立角色上下文和可审计状态，不代表每个 Agent 都是一个常驻分布式进程。

## 会后本地成果与审计

Leader 的会议报告是 `progress-brief` 类型的 Agent artifact，但使用明确的本地可见路径 `meeting-notes/kickoff-summary.md`。它同时提供：

- workspace 内可直接阅读的 Markdown 文件；
- Agent submission、附件和存储证明；
- Manager Flow Graph 节点；
- Timeline 的 Agent submission 记录；
- Event Ledger 的 `agent-submission` 记录；
- 对源会议 transcript、timeline 和 event ledger 的链接。

后续 Agent 的研究、搜索、核验、提交、评审和修订同样会在 Group Chat、Flow Graph、Timeline 与 Event Ledger 中形成可验收记录。回来查看项目时，优先以这些后端证据和本地文件为准，而不是浏览器缓存。

## 验证命令

```powershell
npm run agents:local-meeting-autonomy
npm run agents:project-settings:workspace
npm run agents:smart-meeting-runtime
npm run agents:real-user-zero-to-autonomy
npm run launch:local-mvp:check
```

前 3 个是快速、本地写入量较小的链路检查；`real-user-zero-to-autonomy` 覆盖更完整的 HTTP 与本地 workspace 证据链。

## 范围边界

这是本地/私有 MVP。它可以保留文件、队列、会议、Agent 提交和本地审计证据，但不是公共无人值守生产服务。24/7 调度、分布式队列、托管身份、集中告警、持久化恢复、成本控制和长期审计仍需要托管生产基础设施。
