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
| 能接 API Key 跑真实任务吗？ | **不建议。** BYOK 与安全隔离仍在规划中。 |
| 现在适合做什么？ | 阅读架构、参与 Skill 设计、讨论协作协议、提交 Issue/PR。 |
| 我们卡在哪？ | **阶段 1 → 阶段 2 之间**（见下文）。 |

---

## 二、总体进程规划

完整交付路径分为 **六个里程碑**。前三个是当前核心研发主线；后三个是发布前必做项。

```
M0 原型壳层          ████████████████████  已完成
M1 人物 Skill 设计   ████████░░░░░░░░░░░░  ← 当前主战场
M2 Agent 协作机制    ██████░░░░░░░░░░░░░░  进行中（骨架已有）
M3 运行算法 Runtime  ████░░░░░░░░░░░░░░░░  原型级（非生产）
M4 安全与 BYOK       ░░░░░░░░░░░░░░░░░░░░  未开始
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
- 与真实 LLM 输出结合的容错与重试策略
- 多人贡献时的协议版本管理

**Contributor 可参与：**
- 阅读 [`src/agents/README.md`](src/agents/README.md) 与 [`src/agents/ARCHITECTURE_AUDIT.md`](src/agents/ARCHITECTURE_AUDIT.md)
- 补充 scenario 验证脚本与边界用例
- 在 Issue 中讨论「谁该说话、何时升级、如何记录决策」规则

**退出标准：**
- [ ] Manager Demo scenario 覆盖主要协作路径且可重复
- [ ] 会议 → 任务 → 群聊 → 自治周期 全链路无断点
- [ ] 协作诊断信息对 Contributor 可读、可调试

---

### M3 · 整个运行算法 🔄 原型级

**目标：** Hour Pulse / Day Report 自治循环、项目账本、变更 ledger 在统一 runtime 下稳定推进。

**已有原型：**
- `planAutonomousWorkCycle` + `advanceAutonomousProjectCycle`
- 确定性 runtime（`agentRuntime.js`）用于 UI 演示
- 自治 ledger、agentStates、obligation 持久化契约

**尚未完成：**
- LLM 驱动的真实工作产出（当前大量为规则/模板生成）
- 后端 scheduler 替代浏览器内定时器
- 运行时与 Skill 包的热更新策略
- 性能与成本控制（token、并发、缓存）

**Contributor 可参与：**
- 扩展 `npm run agents:scenario` 覆盖更多项目形态
- 文档化 runtime 输入/输出契约，便于未来替换 LLM backend

**退出标准：**
- [ ] Runtime 契约冻结并文档化
- [ ] 自治周期在 N 轮模拟中状态一致
- [ ] 可插拔 LLM adapter（即使首版仅 stub）

---

### M4 · 安全与 BYOK ⏳ 未开始

**目标：** 用户自带 API Key 时，密钥与数据不出用户边界；满足最低安全基线后再讨论对外使用。

**规划项（均未实现）：**
- API Key 加密存储与 scope 隔离
- 沙箱化 tool / file 访问
- Prompt 注入与跨 Agent 污染防护
- 审计日志与敏感信息 redaction
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
| 2026-05-31 | 首版路线图：明确 Pre-alpha 状态，锁定 M1 为当前主战场 |

---

## English summary

**Hall of Fame Studio is pre-alpha and not safe for production use.** Security guarantees are not in place. Active development focuses on (1) per-persona skill packages, (2) multi-agent collaboration protocols, and (3) the autonomous runtime algorithm — currently between Phase 1 and Phase 2. See sections above for milestone details and contributor entry points.
